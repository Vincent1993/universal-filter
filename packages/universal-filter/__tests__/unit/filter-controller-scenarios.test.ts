import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFilter } from '../../src/core/createFilter';
import type { Draft, PluginFactory } from '../../src/core/types';
import { setGlobalConfigureForTest } from '../../src/context';

// 辅助函数：等待插件就绪
async function waitForPluginsReady(filter: ReturnType<typeof createFilter>, timeout = 1000): Promise<void> {
  if (filter.plugin.ready) return;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout waiting for plugins to be ready'));
    }, timeout);

    filter.once('plugins:ready', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

// 辅助函数：触发表单挂载
function triggerFormMount(filter: ReturnType<typeof createFilter>): void {
  // 手动触发表单挂载逻辑
  filter.form.onMount();
  // 访问私有属性或方法来触发内部逻辑
  const controller = filter as any;
  if (!controller._isFormMounted) {
    controller._isFormMounted = true;
    if (typeof controller.checkReadyState === 'function') {
      controller.checkReadyState();
    }
  }
}

describe('FilterController - 业务场景测试', () => {

  describe('场景 1: 插件初始化并同步数据', () => {
    it('插件在 onInit 中设置初始值，应该反映在 ready 后的 Draft 中', async () => {
      const urlSyncPlugin: PluginFactory<Draft> = (helpers) => ({
        name: 'url-sync',
        onInit: async ({ pluginManager }) => {
          // 模拟从 URL 读取参数并设置到 Draft
          // 使用 setInitialValues 避免触发 change 事件
          helpers.root.setInitialValues({ fromUrl: 'true' }, 'merge');
          pluginManager.markReady('url-sync', true);
        }
      });

      const filter = createFilter({
        plugins: [urlSyncPlugin],
        defaultValues: { original: 'true' }
      });

      await waitForPluginsReady(filter);
      triggerFormMount(filter);

      // 等待 ready 和异步操作
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(filter.ready).toBe(true);
      expect(filter.draft.fromUrl).toBe('true');
      expect(filter.draft.original).toBe('true');
    });

    it('autoApply.onInit 应该提交包含插件设置值的 Draft', async () => {
      const applySpy = vi.fn();

      const initPlugin: PluginFactory<Draft> = (helpers) => ({
        name: 'init-data',
        onInit: ({ pluginManager }) => {
          helpers.root.setInitialValues({ initData: 123 }, 'merge');
          pluginManager.markReady('init-data', true);
        }
      });

      const filter = createFilter({
        plugins: [initPlugin],
        autoApply: { onInit: true },
        listeners: {
          onApplySuccess: applySpy
        }
      });

      // 模拟 apply 实现，因为 formily submit 需要真实环境或 mock
      // 这里我们主要依赖 listeners 验证

      await waitForPluginsReady(filter);
      triggerFormMount(filter);

      // 等待 microtask 和 apply
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(filter.ready).toBe(true);
      expect(applySpy).toHaveBeenCalled();
      const payload = applySpy.mock.calls[0]?.[0];
      expect(payload?.draft?.initData).toBe(123);
    });
  });

  describe('场景 2: 自动提交 (autoApply)', () => {
    it('配置 autoApply.onChange 应在 draft 变化时自动触发 apply', async () => {
      const applySuccessSpy = vi.fn();

      const filter = createFilter({
        autoApply: { onChange: true },
        listeners: {
          onApplySuccess: applySuccessSpy
        }
      });

      await waitForPluginsReady(filter);
      triggerFormMount(filter);
      await new Promise(resolve => setTimeout(resolve, 10));

      // 修改 Draft
      filter.setValue('search', 'keyword');

      // 等待 debounce (默认无) 和 async execution
      // autoApply 使用 queueMicrotask，所以需要等待
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(applySuccessSpy).toHaveBeenCalled();
      expect(filter.applied?.search).toBe('keyword');
    });

    it('autoApply.onChange 应该遵循 debounce 配置', async () => {
      const applySuccessSpy = vi.fn();

      const filter = createFilter({
        autoApply: { onChange: true },
        applyDebounceMs: 100, // 设置防抖
        listeners: {
          onApplySuccess: applySuccessSpy
        }
      });

      await waitForPluginsReady(filter);
      triggerFormMount(filter);
      await new Promise(resolve => setTimeout(resolve, 10));

      // 快速多次修改
      filter.setValue('q', 'a');
      filter.setValue('q', 'ab');
      filter.setValue('q', 'abc');

      // 立即检查，不应调用
      expect(applySuccessSpy).not.toHaveBeenCalled();

      // 等待防抖时间
      await new Promise(resolve => setTimeout(resolve, 150));

      // 应该只调用一次
      expect(applySuccessSpy).toHaveBeenCalledTimes(1);
      expect(filter.applied?.q).toBe('abc');
    });
  });

  describe('场景 3: 插件生命周期与 Hook 顺序', () => {
    it('多个插件的 hooks 应该按注册顺序执行', async () => {
      const callOrder: string[] = [];

      const pluginA: PluginFactory<Draft> = () => ({
        name: 'PluginA',
        onApplyStart: () => { callOrder.push('A:start'); },
        onApplySuccess: () => { callOrder.push('A:success'); }
      });

      const pluginB: PluginFactory<Draft> = () => ({
        name: 'PluginB',
        onApplyStart: () => { callOrder.push('B:start'); },
        onApplySuccess: () => { callOrder.push('B:success'); }
      });

      const filter = createFilter({
        plugins: [pluginA, pluginB]
      });

      await waitForPluginsReady(filter);
      triggerFormMount(filter);

      await filter.apply();

      // 验证顺序
      expect(callOrder).toEqual([
        'A:start',
        'B:start',
        'A:success',
        'B:success'
      ]);
    });

    it('插件应该能够通过 API 阻止流程或抛出错误', async () => {
        // Formily 的 submit 流程中，验证失败会阻止提交
        // 但插件的 onApplyStart 只是监听，无法直接阻止 submit
        // 除非抛出异常，这会导致 apply promise reject

        const errorPlugin: PluginFactory<Draft> = () => ({
            name: 'ErrorPlugin',
            onApplyStart: () => {
                throw new Error('Blocked by plugin');
            }
        });

        const filter = createFilter({
            plugins: [errorPlugin]
        });

        await waitForPluginsReady(filter);
        triggerFormMount(filter);

        await expect(filter.apply()).rejects.toThrow('Blocked by plugin');
    });
  });

  describe('场景 4: 全局配置集成', () => {
    afterEach(() => {
        // 清理全局配置
        setGlobalConfigureForTest({});
    });

    it('全局配置的插件应该被自动应用', async () => {
      const globalPluginInitSpy = vi.fn();
      const globalPlugin: PluginFactory<Draft> = () => ({
        name: 'global-plugin',
        onInit: globalPluginInitSpy
      });

      // 设置全局配置
      setGlobalConfigureForTest({
        defaults: {
            plugins: [globalPlugin]
        }
      });

      // 创建实例（不传插件）
      const filter = createFilter();

      await waitForPluginsReady(filter);

      expect(globalPluginInitSpy).toHaveBeenCalled();
      // 验证插件管理器中包含该插件
      expect(filter.plugin.get('global-plugin')).toBeDefined();
    });

    it('实例插件应该与全局插件合并', async () => {
        const globalPlugin: PluginFactory<Draft> = () => ({ name: 'global' });
        const localPlugin: PluginFactory<Draft> = () => ({ name: 'local' });

        setGlobalConfigureForTest({
            defaults: { plugins: [globalPlugin] }
        });

        const filter = createFilter({
            plugins: [localPlugin]
        });

        await waitForPluginsReady(filter);

        expect(filter.plugin.get('global')).toBeDefined();
        expect(filter.plugin.get('local')).toBeDefined();
    });
  });
});

