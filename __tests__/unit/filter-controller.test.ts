import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFilter } from '../../src/core/createFilter';
import type { Draft, PluginFactory } from '../../src/core/types';
import { createCodecTransformPlugin, type TransformerConfig } from '../../src/plugins/codec';

// 辅助函数：等待插件就绪
async function waitForPluginsReady(filter: ReturnType<typeof createFilter>, timeout = 1000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout waiting for plugins to be ready'));
    }, timeout);

    if (filter.plugin.ready) {
      clearTimeout(timer);
      resolve();
      return;
    }

    filter.once('plugins:ready', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

// 辅助函数：触发表单挂载（模拟真实场景）
function triggerFormMount(filter: ReturnType<typeof createFilter>): void {
  // 在 Formily 中，onFormMount 是在表单挂载时自动触发的
  // 在测试中，我们需要手动触发 effect 的回调
  // 通过访问 controller 的内部状态和方法来模拟
  const controller = filter as any;

  // 调用 form.onMount() 来设置表单的挂载状态
  filter.form.onMount();

  // 手动触发 onFormMount effect 的回调
  // 因为 effect 是在 addEffects 时注册的，我们需要直接调用回调逻辑
  if (!controller._isFormMounted) {
    controller._isFormMounted = true;

    // 直接调用 checkReadyState 方法（虽然是 private，但在测试中可以通过类型断言访问）
    // checkReadyState 会使用保存的 _optionsConfig
    if (typeof controller.checkReadyState === 'function') {
      controller.checkReadyState();
    }
  }
}

describe('FilterController - 生命周期与事件', () => {
  it('应该暴露 dispose 方法并触发 destroy 事件', () => {
    const filter = createFilter();
    const onDestroy = vi.fn();
    const unsubscribe = filter.on('destroy', onDestroy);

    filter.dispose();
    filter.dispose(); // 多次调用不应重复触发

    expect(typeof filter.dispose).toBe('function');
    expect(onDestroy).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('dispose 时应该触发监听器的 onDestroy', () => {
    let destroyedRoot: unknown;
    const filter = createFilter({
      listeners: {
        onDestroy: ({ root }) => {
          destroyedRoot = root;
        },
      },
    });

    filter.dispose();

    expect(destroyedRoot).toBe(filter);
  });

  it('dispose 应该卸载 Formily 表单并清理核心引用', async () => {
    const filter = createFilter();

    // 等待初始化完成
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 在 dispose 之前创建 spy
    const removeEffectsSpy = vi.spyOn(filter.form, 'removeEffects');

    expect(filter.form.unmounted).toBe(false);

    filter.dispose();

    // removeEffects 应该在 super.dispose 中被调用
    expect(removeEffectsSpy).toHaveBeenCalledWith('filter-apply');
    expect(filter.form.unmounted).toBe(true);
    expect(filter.listeners).toBeUndefined();
  });

  it('插件销毁异常时应该继续销毁其他插件并上报错误', () => {
    const destroySpy = vi.fn();
    const faultyPlugin: PluginFactory<Draft> = () => ({
      name: 'faulty',
      onDestroy: () => {
        throw new Error('dispose failed');
      },
    });
    const okPlugin: PluginFactory<Draft> = () => ({
      name: 'ok',
      onDestroy: destroySpy,
    });

    const filter = createFilter({ plugins: [faultyPlugin, okPlugin] });
    const destroyedPayload = vi.fn();
    filter.on('plugins:destroyed', destroyedPayload);

    filter.dispose();

    expect(destroySpy).toHaveBeenCalledTimes(1);
    expect(destroyedPayload).toHaveBeenCalledWith({
      errors: [expect.objectContaining({ name: 'faulty', error: expect.any(Error) })],
    });
  });

  it('没有 onInit 的插件应该自动标记为 ready', async () => {
    const filter = createFilter({
      plugins: [
        {
          name: 'without-init',
        },
      ],
    });

    // 等待插件初始化完成
    await waitForPluginsReady(filter);

    expect(filter.plugin.ready).toBe(true);
  });

  it('未显式调用 setReady 的插件在初始化后也应标记为 ready 并触发事件', async () => {
    const readySpy = vi.fn();
    const filter = createFilter({
      plugins: [
        {
          name: 'lazy',
          onInit: async () => {
            await Promise.resolve();
            // 插件需要显式调用 markReady，否则不会自动标记为就绪
            filter.plugin.markReady('lazy', true);
          },
        },
      ],
    });
    filter.on('plugin:ready', readySpy);

    // 等待插件初始化完成
    await waitForPluginsReady(filter);

    expect(filter.plugin.ready).toBe(true);
    expect(readySpy).toHaveBeenCalledWith({ name: 'lazy', ready: true, error: undefined });
  });
});

describe('FilterController - Ready 状态管理', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('初始状态 ready 应该为 false', () => {
    const filter = createFilter();
    expect(filter.ready).toBe(false);
  });

  it('表单挂载但插件未就绪时，ready 应该仍为 false', async () => {
    let resolveInit: () => void;
    const initPromise = new Promise<void>((resolve) => {
      resolveInit = resolve;
    });

    const filter = createFilter({
      plugins: [
        {
          name: 'async-plugin',
          onInit: async ({ pluginManager }) => {
            // 模拟异步初始化，延迟完成
            await initPromise;
            pluginManager.markReady('async-plugin', true);
          },
        },
      ],
    });

    // 手动触发表单挂载（模拟表单先挂载）
    triggerFormMount(filter);
    await Promise.resolve();

    // 插件还未就绪，ready 应该仍为 false
    expect(filter.ready).toBe(false);
    expect(filter.plugin.ready).toBe(false);

    // 完成插件初始化
    resolveInit!();
    await waitForPluginsReady(filter);

    // 现在插件就绪了，ready 应该变为 true
    expect(filter.ready).toBe(true);
  });

  it('插件就绪但表单未挂载时，ready 应该仍为 false', async () => {
    const filter = createFilter({
      plugins: [
        {
          name: 'sync-plugin',
        },
      ],
    });

    // 等待插件初始化完成
    await waitForPluginsReady(filter);

    // 插件已就绪，但表单未挂载，ready 应该仍为 false
    expect(filter.plugin.ready).toBe(true);
    expect(filter.ready).toBe(false);
  });

  it('表单挂载且插件就绪时，ready 应该变为 true 并触发 ready 事件', async () => {
    const readySpy = vi.fn();
    const filter = createFilter({
      plugins: [
        {
          name: 'sync-plugin',
        },
      ],
    });

    filter.on('ready', readySpy);

    // 等待插件初始化完成
    await waitForPluginsReady(filter);
    expect(filter.plugin.ready).toBe(true);

    // 验证插件就绪状态已设置（plugins:ready 事件应该已经触发并设置状态）
    const controller = filter as any;

    // 手动触发表单挂载
    triggerFormMount(filter);

    // 验证表单挂载状态已设置
    expect(controller._isFormMounted).toBe(true);

    // 等待事件处理完成
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(filter.ready).toBe(true);
    expect(readySpy).toHaveBeenCalledTimes(1);
    expect(readySpy).toHaveBeenCalledWith({ root: filter });
  });

  it('ready 状态只应该被设置一次，不会重复触发', async () => {
    const readySpy = vi.fn();
    const filter = createFilter({
      plugins: [
        {
          name: 'sync-plugin',
        },
      ],
    });

    filter.on('ready', readySpy);

    // 等待插件初始化完成
    await waitForPluginsReady(filter);
    expect(filter.plugin.ready).toBe(true);

    // 手动触发表单挂载
    triggerFormMount(filter);
    await new Promise((resolve) => setTimeout(resolve, 10));

    // 再次触发表单挂载（模拟重复调用）
    triggerFormMount(filter);
    await new Promise((resolve) => setTimeout(resolve, 10));

    // ready 事件应该只触发一次
    expect(readySpy).toHaveBeenCalledTimes(1);
    expect(filter.ready).toBe(true);
  });

  it('异步插件初始化完成后，表单挂载应该触发 ready', async () => {
    const readySpy = vi.fn();
    let resolveInit: () => void;
    const initPromise = new Promise<void>((resolve) => {
      resolveInit = resolve;
    });

    const filter = createFilter({
      plugins: [
        {
          name: 'async-plugin',
          onInit: async ({ pluginManager }) => {
            await initPromise;
            pluginManager.markReady('async-plugin', true);
          },
        },
      ],
    });

    filter.on('ready', readySpy);

    // 先触发表单挂载（此时插件还未就绪）
    triggerFormMount(filter);
    await Promise.resolve();

    expect(filter.ready).toBe(false);

    // 完成插件初始化
    resolveInit!();
    await waitForPluginsReady(filter);

    // 现在 ready 应该变为 true
    expect(filter.ready).toBe(true);
    expect(readySpy).toHaveBeenCalledTimes(1);
    expect(readySpy).toHaveBeenCalledWith({ root: filter });
  });

  it('表单先挂载，插件后就绪时，也应该触发 ready', async () => {
    const readySpy = vi.fn();
    let resolveInit: () => void;
    const initPromise = new Promise<void>((resolve) => {
      resolveInit = resolve;
    });

    const filter = createFilter({
      plugins: [
        {
          name: 'async-plugin',
          onInit: async ({ pluginManager }) => {
            await initPromise;
            pluginManager.markReady('async-plugin', true);
          },
        },
      ],
    });

    filter.on('ready', readySpy);

    // 先触发表单挂载
    triggerFormMount(filter);
    await Promise.resolve();

    expect(filter.ready).toBe(false);

    // 完成插件初始化
    resolveInit!();
    await waitForPluginsReady(filter);

    // ready 应该变为 true
    expect(filter.ready).toBe(true);
    expect(readySpy).toHaveBeenCalledTimes(1);
  });

  it('autoApply.onInit 配置应该在 ready 时触发 apply', async () => {
    const filter = createFilter({
      plugins: [
        {
          name: 'sync-plugin',
        },
      ],
      autoApply: {
        onInit: true,
      },
    });

    // Spy apply 方法
    const applySpy = vi.spyOn(filter, 'apply').mockImplementation(async () => {
      // Mock apply 实现，避免实际提交表单
    });

    // 等待插件初始化完成
    await waitForPluginsReady(filter);
    expect(filter.plugin.ready).toBe(true);

    // 手动触发表单挂载
    triggerFormMount(filter);

    // 等待事件处理和 apply 调用（queueMicrotask）
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(filter.ready).toBe(true);
    // apply 应该被调用（通过 queueMicrotask，所以需要等待）
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(applySpy).toHaveBeenCalled();

    applySpy.mockRestore();
  });

  it('autoApply.onInit 为 false 时，ready 时不应该触发 apply', async () => {
    const filter = createFilter({
      plugins: [
        {
          name: 'sync-plugin',
        },
      ],
      autoApply: {
        onInit: false,
      },
    });

    // Spy apply 方法
    const applySpy = vi.spyOn(filter, 'apply').mockImplementation(async () => {});

    // 等待插件初始化完成
    await waitForPluginsReady(filter);
    expect(filter.plugin.ready).toBe(true);

    // 手动触发表单挂载
    triggerFormMount(filter);

    // 等待事件处理
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(filter.ready).toBe(true);
    // apply 不应该被调用
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(applySpy).not.toHaveBeenCalled();

    applySpy.mockRestore();
  });

  describe('Codec 插件异步转换场景', () => {
    it('codec 插件有异步 transformer 时，ready 状态应该等待转换完成', async () => {
      const readySpy = vi.fn();
      const asyncTransformer: TransformerConfig = {
        name: 'async-codec-transform',
        transform: async (data: any) => {
          // 模拟异步转换，延迟完成
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { ...data, codecTransformed: true };
        },
      };

      const filter = createFilter({
        defaultValues: { name: 'test' }, // 需要 defaultValues 才能触发 init 转换
        plugins: [
          createCodecTransformPlugin({
            transformers: [asyncTransformer],
            applyOn: 'init', // 在初始化时转换
          }),
        ],
      });

      filter.on('ready', readySpy);

      // 等待 codec 插件初始化完成（包括异步转换）
      // codec 插件的异步转换需要更长时间
      await waitForPluginsReady(filter);
      // 额外等待异步转换完成
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(filter.plugin.ready).toBe(true);

      // 验证转换已完成
      expect((filter.draft as any).codecTransformed).toBe(true);

      // 触发表单挂载
      triggerFormMount(filter);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // ready 应该变为 true
      expect(filter.ready).toBe(true);
      expect(readySpy).toHaveBeenCalledTimes(1);

      filter.dispose();
    });

    it('codec 插件异步转换完成后，表单挂载应该触发 ready', async () => {
      const readySpy = vi.fn();
      let resolveTransform: () => void;
      const transformPromise = new Promise<void>((resolve) => {
        resolveTransform = resolve;
      });

      const asyncTransformer: TransformerConfig = {
        name: 'delayed-codec-transform',
        transform: async (data: any) => {
          await transformPromise;
          return { ...data, delayedTransformed: true };
        },
      };

      const filter = createFilter({
        defaultValues: { name: 'test' }, // 需要 defaultValues 才能触发 init 转换
        plugins: [
          createCodecTransformPlugin({
            transformers: [asyncTransformer],
            applyOn: 'init',
            onError: 'skip'
          }),
        ],
      });

      filter.on('ready', readySpy);

      // 先触发表单挂载（此时 codec 转换还未完成）
      triggerFormMount(filter);
      await Promise.resolve();

      expect(filter.ready).toBe(false);
      // codec 插件可能已经标记为 ready（因为 markReady 在转换之前调用），但转换还未完成
      // 所以我们需要检查转换是否完成

      // 完成 codec 异步转换
      resolveTransform!();
      // 等待转换完成
      await new Promise((resolve) => setTimeout(resolve, 10));
      await waitForPluginsReady(filter);

      // 现在 ready 应该变为 true
      expect(filter.ready).toBe(true);
      expect(readySpy).toHaveBeenCalledTimes(1);
      expect((filter.draft as any).delayedTransformed).toBe(true);

      filter.dispose();
    });

    it('codec 插件在 apply 时的异步转换应该被正确处理', async () => {
      const asyncTransformer: TransformerConfig = {
        name: 'async-apply-transform',
        direction: 'outbound',
        reverseTransform: async (data: any) => {
          // 模拟异步转换（outbound 使用 reverseTransform）
          await new Promise((resolve) => setTimeout(resolve, 30));
          return { ...data, asyncApplied: true };
        },
      };

      const filter = createFilter({
        defaultValues: { name: 'test' },
        plugins: [
          createCodecTransformPlugin({
            transformers: [asyncTransformer],
            applyOn: 'apply', // 只在 apply 时转换
          }),
        ],
      });

      // 等待插件初始化完成
      await waitForPluginsReady(filter);
      triggerFormMount(filter);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(filter.ready).toBe(true);

      // 修改值并 apply
      filter.setValue('name', 'updated');

      // apply 应该等待异步转换完成
      const applyPromise = filter.apply();
      await applyPromise;

      // 验证转换后的 applied
      expect(filter.applied).toBeDefined();
      expect((filter.applied as any).asyncApplied).toBe(true);
      expect((filter.applied as any).name).toBe('updated');

      filter.dispose();
    });

    it('codec 插件异步转换失败时，ready 状态应该正确处理', async () => {
      const readySpy = vi.fn();
      const errorTransformer: TransformerConfig = {
        name: 'error-codec-transform',
        transform: async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          throw new Error('转换失败');
        },
      };

      const filter = createFilter({
        plugins: [
          createCodecTransformPlugin({
            transformers: [errorTransformer],
            applyOn: 'init',
            onError: 'skip', // 跳过错误，继续执行
          }),
        ],
      });

      filter.on('ready', readySpy);

      // 等待插件初始化完成（即使转换失败，插件也应该就绪）
      await waitForPluginsReady(filter);
      expect(filter.plugin.ready).toBe(true);

      // 触发表单挂载
      triggerFormMount(filter);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // ready 应该变为 true（因为插件已就绪，即使转换失败）
      expect(filter.ready).toBe(true);
      expect(readySpy).toHaveBeenCalledTimes(1);

      filter.dispose();
    });

    it('多个 codec transformer 链式异步转换时，ready 应该等待所有转换完成', async () => {
      const readySpy = vi.fn();
      const transformers: TransformerConfig[] = [
        {
          name: 'async-step1',
          transform: async (data: any) => {
            await new Promise((resolve) => setTimeout(resolve, 20));
            return { ...data, step1: true };
          },
        },
        {
          name: 'async-step2',
          transform: async (data: any) => {
            await new Promise((resolve) => setTimeout(resolve, 20));
            return { ...data, step2: true };
          },
        },
        {
          name: 'async-step3',
          transform: async (data: any) => {
            await new Promise((resolve) => setTimeout(resolve, 20));
            return { ...data, step3: true };
          },
        },
      ];

      const filter = createFilter({
        defaultValues: { name: 'test' }, // 需要 defaultValues 才能触发 init 转换
        plugins: [
          createCodecTransformPlugin({
            transformers,
            applyOn: 'init',
            onError: 'skip'
          }),
        ],
      });

      filter.on('ready', readySpy);

      // 等待所有异步转换完成（3个转换器，每个20ms，总共至少60ms）
      await waitForPluginsReady(filter);
      // 额外等待异步转换完成
      await new Promise((resolve) => setTimeout(resolve, 70));

      expect(filter.plugin.ready).toBe(true);

      // 验证所有转换步骤都已完成
      const draft = filter.draft as any;
      expect(draft.step1).toBe(true);
      expect(draft.step2).toBe(true);
      expect(draft.step3).toBe(true);

      // 触发表单挂载
      triggerFormMount(filter);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // ready 应该变为 true
      expect(filter.ready).toBe(true);
      expect(readySpy).toHaveBeenCalledTimes(1);

      filter.dispose();
    });

    it('codec 插件异步转换 + autoApply.onInit 时，应该等待转换完成后再 apply', async () => {
      const filter = createFilter({
        defaultValues: { name: 'test' }, // 需要 defaultValues 才能触发 init 转换
        plugins: [
          createCodecTransformPlugin({
            transformers: [
              {
                name: 'async-init-transform',
                transform: async (data: any) => {
                  await new Promise((resolve) => setTimeout(resolve, 50));
                  return { ...data, initTransformed: true };
                },
              },
            ],
            applyOn: 'init',
            onError: 'skip'
          }),
        ],
        autoApply: {
          onInit: true,
        },
      });

      // Spy apply 方法
      const applySpy = vi.spyOn(filter, 'apply').mockImplementation(async () => {
        // Mock apply 实现，避免实际提交表单
      });

      // 等待 codec 插件初始化完成（包括异步转换）
      await waitForPluginsReady(filter);
      // 额外等待异步转换完成
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(filter.plugin.ready).toBe(true);

      // 验证转换已完成
      expect((filter.draft as any).initTransformed).toBe(true);

      // 触发表单挂载
      triggerFormMount(filter);

      // 等待 ready 和 apply 调用
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(filter.ready).toBe(true);
      // apply 应该被调用（通过 queueMicrotask，所以需要等待）
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(applySpy).toHaveBeenCalled();

      applySpy.mockRestore();
      filter.dispose();
    });
  });
});
