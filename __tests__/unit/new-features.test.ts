/**
 * 新功能测试
 * 测试审查后新增的所有功能：
 * - beforeApply BailHook
 * - beforeDraftChange WaterfallHook
 * - waitForReady()
 * - destroy hook with root payload
 * - off() 健壮性
 * - options hooks
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createFilter } from '../../src/core/createFilter';
import type { Draft, FilterApi, PluginFactory } from '../../src/core/types';

// 辅助函数
async function waitForPluginsReady<TDraft extends Draft = Draft>(filter: FilterApi<TDraft>, timeout = 1000): Promise<void> {
  if (filter.plugin.ready) return;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), timeout);
    filter.once('plugins:ready', () => { clearTimeout(timer); resolve(); });
  });
}

function triggerFormMount<TDraft extends Draft = Draft>(filter: FilterApi<TDraft>): void {
  filter.form.onMount();
  const controller = filter as any;
  if (!controller._isFormMounted) {
    controller._isFormMounted = true;
    if (typeof controller.checkReadyState === 'function') {
      controller.checkReadyState();
    }
  }
}

describe('beforeApply BailHook', () => {
  it('返回 true 应该阻止 apply 流程', async () => {
    const applySuccessSpy = vi.fn();
    const filter = createFilter({
      defaultValues: { keyword: '' },
      listeners: { onApplySuccess: applySuccessSpy },
    });

    filter.hooks.beforeApply.tap('guard', ({ draft }): boolean => {
      if (!draft.keyword) return true; // bail
      return false;
    });

    await waitForPluginsReady(filter);
    triggerFormMount(filter);
    await new Promise(r => setTimeout(r, 10));

    await filter.apply();

    // apply 被拦截，不应该触发 success
    expect(applySuccessSpy).not.toHaveBeenCalled();
  });

  it('不返回 true 时 apply 应该正常执行', async () => {
    const applySuccessSpy = vi.fn();
    const filter = createFilter({
      defaultValues: { keyword: 'test' },
      listeners: { onApplySuccess: applySuccessSpy },
    });

    filter.hooks.beforeApply.tap('guard', ({ draft }): boolean => {
      if (!draft.keyword) return true;
      return false;
    });

    await waitForPluginsReady(filter);
    triggerFormMount(filter);
    await new Promise(r => setTimeout(r, 10));

    await filter.apply();

    expect(applySuccessSpy).toHaveBeenCalled();
  });

  it('多个 tap 中任意一个返回 true 即拦截', async () => {
    const applySuccessSpy = vi.fn();
    const filter = createFilter({ defaultValues: { a: 1 } });
    filter.hooks.applySuccess.tap('spy', applySuccessSpy);

    // @ts-expect-error tapable SyncBailHook requires boolean return, but undefined means "don't bail"
    filter.hooks.beforeApply.tap('pass', () => { /* 不拦截 */ });
    filter.hooks.beforeApply.tap('block', (): boolean => true);

    await waitForPluginsReady(filter);
    triggerFormMount(filter);
    await new Promise(r => setTimeout(r, 10));

    await filter.apply();
    expect(applySuccessSpy).not.toHaveBeenCalled();
  });
});

describe('beforeDraftChange WaterfallHook', () => {
  it('应该能在值写入前进行转换', async () => {
    const filter = createFilter<{ name: string }>({
      defaultValues: { name: 'hello' },
    });

    // 注册 trim 转换器
    filter.hooks.beforeDraftChange.tap('trim', (draft) => {
      return { ...draft, name: draft.name?.trim() };
    });

    await waitForPluginsReady(filter);

    // 设置一个带空格的值
    filter.setValue('name', '  spaces  ');

    // 值应该被自动 trim
    expect(filter.draft.name).toBe('spaces');
  });

  it('多个 tap 应该链式执行', async () => {
    const filter = createFilter<{ value: string }>({
      defaultValues: { value: 'hello' },
    });

    filter.hooks.beforeDraftChange.tap('upper', (draft) => {
      return { ...draft, value: draft.value?.toUpperCase() };
    });

    filter.hooks.beforeDraftChange.tap('prefix', (draft) => {
      return { ...draft, value: `PREFIX_${draft.value}` };
    });

    await waitForPluginsReady(filter);

    filter.setValue('value', 'test');

    expect(filter.draft.value).toBe('PREFIX_TEST');
  });

  it('不修改数据时不应该触发额外的 setValues', async () => {
    const filter = createFilter<{ name: string }>({
      defaultValues: { name: 'hello' },
    });

    const setValuesSpy = vi.spyOn(filter.form, 'setValues');
    const callCount = setValuesSpy.mock.calls.length;

    // 注册一个不修改数据的 tap
    filter.hooks.beforeDraftChange.tap('noop', (draft) => draft);

    filter.setValue('name', 'world');

    // setValues 不应该被额外调用（只有 setValue 触发的那一次）
    // 因为 beforeDraftChange 返回了相同的值
    // 注意：setValues 可能被 Formily 内部调用，我们只检查没有因为 beforeDraftChange 多调一次
    expect(setValuesSpy.mock.calls.length - callCount).toBeLessThanOrEqual(1);
  });
});

describe('waitForReady()', () => {
  it('已经 ready 时应该立即 resolve', async () => {
    const filter = createFilter();
    await waitForPluginsReady(filter);
    triggerFormMount(filter);
    await new Promise(r => setTimeout(r, 10));

    expect(filter.ready).toBe(true);
    await expect(filter.waitForReady()).resolves.toBeUndefined();
  });

  it('未 ready 时应该在 ready 后 resolve', async () => {
    const filter = createFilter({
      plugins: [{ name: 'sync' }],
    });

    const readyPromise = filter.waitForReady();

    // 触发 ready
    await waitForPluginsReady(filter);
    triggerFormMount(filter);

    await expect(readyPromise).resolves.toBeUndefined();
    expect(filter.ready).toBe(true);
  });

  it('超时时应该 reject', async () => {
    let resolveInit: () => void;
    const initPromise = new Promise<void>(r => { resolveInit = r; });

    const filter = createFilter({
      plugins: [{
        name: 'slow',
        async onInit({ pluginManager }) {
          await initPromise;
          pluginManager.markReady('slow', true);
        },
      }],
    });

    // 设置很短的超时
    await expect(filter.waitForReady(50)).rejects.toThrow('timed out');

    // 清理
    resolveInit!();
    await new Promise(r => setTimeout(r, 10));
    filter.dispose();
  });
});

describe('destroy hook with root payload', () => {
  it('destroy hook 应该包含 root 引用', () => {
    const destroySpy = vi.fn();
    const filter = createFilter();

    filter.hooks.destroy.tap('test', destroySpy);
    filter.dispose();

    expect(destroySpy).toHaveBeenCalledWith({ root: filter });
  });

  it('onDestroy listener 应该通过 destroy hook 接收 root', () => {
    let destroyedRoot: unknown;
    const filter = createFilter({
      listeners: {
        onDestroy: ({ root }) => { destroyedRoot = root; },
      },
    });

    filter.dispose();
    expect(destroyedRoot).toBe(filter);
  });
});

describe('off() 健壮性', () => {
  it('off 后 listener 不应该再被调用', () => {
    const filter = createFilter();
    const spy = vi.fn();

    const unsub = filter.on('draft:change', spy);
    filter.setValue('x', 1);
    expect(spy).toHaveBeenCalledTimes(1);

    // off
    unsub();
    spy.mockClear();

    filter.setValue('x', 2);
    expect(spy).not.toHaveBeenCalled();
  });

  it('once 触发后不应该再被调用', async () => {
    const filter = createFilter();
    const spy = vi.fn();

    filter.once('draft:change', spy);
    filter.setValue('x', 1);
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockClear();
    filter.setValue('x', 2);
    expect(spy).not.toHaveBeenCalled();
  });

  it('多次 off 同一个 listener 不应该报错', () => {
    const filter = createFilter();
    const spy = vi.fn();

    const unsub = filter.on('draft:change', spy);
    unsub();
    unsub(); // 重复调用不应该报错
    expect(() => filter.off('draft:change', spy)).not.toThrow();
  });
});

describe('hooks 完整性', () => {
  it('FilterApi 应该暴露所有 hooks', () => {
    const filter = createFilter();
    const hooks = filter.hooks;

    // 核心生命周期
    expect(hooks.init).toBeDefined();
    expect(hooks.ready).toBeDefined();
    expect(hooks.destroy).toBeDefined();

    // 数据流
    expect(hooks.beforeDraftChange).toBeDefined();
    expect(hooks.draftChange).toBeDefined();
    expect(hooks.beforeApply).toBeDefined();
    expect(hooks.applyStart).toBeDefined();
    expect(hooks.applySuccess).toBeDefined();
    expect(hooks.validateFailed).toBeDefined();
    expect(hooks.reset).toBeDefined();

    // 数据转换管道
    expect(hooks.processSnapshot).toBeDefined();

    // 插件
    expect(hooks.pluginReady).toBeDefined();
    expect(hooks.pluginsReady).toBeDefined();
    expect(hooks.pluginsAttached).toBeDefined();
    expect(hooks.pluginsDestroyed).toBeDefined();

    // Options
    expect(hooks.optionsLoad).toBeDefined();
    expect(hooks.optionsLoaded).toBeDefined();
    expect(hooks.optionsError).toBeDefined();

    filter.dispose();
  });

  it('hooks.intercept 应该可用', () => {
    const filter = createFilter();

    const interceptSpy = vi.fn();
    filter.hooks.draftChange.intercept({
      call: interceptSpy,
    });

    filter.setValue('x', 1);

    expect(interceptSpy).toHaveBeenCalled();
    filter.dispose();
  });
});

describe('插件通过 hooks 注册生命周期', () => {
  it('插件应该在 onInit 中通过 hooks 注册', async () => {
    const callOrder: string[] = [];

    const myPlugin: PluginFactory<Draft> = () => ({
      name: 'my-plugin',
      onInit({ filter, pluginManager }) {
        filter.hooks.draftChange.tap('my-plugin', () => { callOrder.push('draftChange'); });
        filter.hooks.applyStart.tap('my-plugin', () => { callOrder.push('applyStart'); });
        filter.hooks.applySuccess.tap('my-plugin', () => { callOrder.push('applySuccess'); });
        filter.hooks.reset.tap('my-plugin', () => { callOrder.push('reset'); });
        pluginManager.markReady('my-plugin', true);
      }
    });

    const filter = createFilter({
      defaultValues: { name: 'test' },
      plugins: [myPlugin],
    });

    await waitForPluginsReady(filter);
    triggerFormMount(filter);
    await new Promise(r => setTimeout(r, 10));

    // 触发 draft change
    filter.setValue('name', 'updated');
    expect(callOrder).toContain('draftChange');

    // 触发 apply
    await filter.apply();
    expect(callOrder).toContain('applyStart');
    expect(callOrder).toContain('applySuccess');

    // 触发 reset
    filter.reset();
    expect(callOrder).toContain('reset');

    filter.dispose();
  });
});
