/**
 * PluginManager 完整功能测试
 * 测试插件管理器的所有功能：注册、初始化、生命周期管理和状态维护
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import EventEmitter from 'eventemitter3';
import { PluginManager } from '../../src/core/managers/PluginManager';
import type {
  Draft,
  Plugin,
  FilterApi,
  PluginFactory,
  FilterEventMap,
} from '../../src/core/types';
import { createFilter } from '../../src/core/createFilter';

interface TestDraft extends Draft {
  name: string;
  age: number;
}

describe('PluginManager - 完整功能测试', () => {
  let bus: EventEmitter<FilterEventMap<TestDraft>>;
  let filterApi: FilterApi<TestDraft>;
  let manager: PluginManager<TestDraft>;

  beforeEach(() => {
    bus = new EventEmitter<FilterEventMap<TestDraft>>();
    filterApi = createFilter<TestDraft>({
      defaultValues: { name: 'John', age: 30 },
    });
  });

  afterEach(() => {
    if (manager) {
      manager.dispose();
    }
    bus.removeAllListeners();
  });

  describe('构造函数和初始化', () => {
    it('应该正确初始化 PluginManager', async () => {
      const plugin: Plugin<TestDraft> = {
        name: 'test-plugin',
      };

      manager = new PluginManager(
        bus,
        [plugin],
        [],
        'append',
        filterApi
      );

      // 等待异步初始化完成
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(manager).toBeDefined();
      expect(manager.isReady('test-plugin')).toBe(true);
    });

    it('应该正确初始化多个插件', async () => {
      const plugins: Plugin<TestDraft>[] = [
        { name: 'plugin-1' },
        { name: 'plugin-2' },
        { name: 'plugin-3' },
      ];

      manager = new PluginManager(bus, plugins, [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(manager.isReady('plugin-1')).toBe(true);
      expect(manager.isReady('plugin-2')).toBe(true);
      expect(manager.isReady('plugin-3')).toBe(true);
      expect(manager.ready).toBe(true);
    });

    it('应该触发 plugins:attached 事件', async () => {
      const attachedSpy = vi.fn();
      const plugins: Plugin<TestDraft>[] = [
        { name: 'plugin-1' },
        { name: 'plugin-2' },
      ];

      bus.on('plugins:attached', attachedSpy);

      manager = new PluginManager(bus, plugins, [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(attachedSpy).toHaveBeenCalledWith({ total: 2 });
    });
  });

  describe('插件合并策略', () => {
    // 创建测试子类以访问 protected 方法
    class TestablePluginManager<TDraft extends Draft> extends PluginManager<TDraft> {
      public testMergePluginFactories(
        instancePlugins: PluginFactory<TDraft>[],
        globalPlugins: PluginFactory<TDraft>[],
        mergeStrategy: 'prepend' | 'append'
      ): PluginFactory<TDraft>[] {
        return this.mergePluginFactories(instancePlugins, globalPlugins, mergeStrategy);
      }

      public testResolvePluginFactories(
        factories: PluginFactory<TDraft>[],
        filterApi: FilterApi<TDraft>
      ): Plugin<TDraft>[] {
        return this.resolvePluginFactories(factories, filterApi);
      }
    }

    it('应该使用 prepend 策略：实例插件在前', () => {
      const globalPlugin: PluginFactory<TestDraft> = () => ({ name: 'global' });
      const instancePlugin: PluginFactory<TestDraft> = () => ({ name: 'instance' });

      const testManager = new TestablePluginManager(
        bus,
        [instancePlugin],
        [globalPlugin],
        'prepend',
        filterApi
      );

      const merged = testManager.testMergePluginFactories(
        [instancePlugin],
        [globalPlugin],
        'prepend'
      );

      // 验证合并后的顺序
      const resolved = testManager.testResolvePluginFactories(merged, filterApi);
      expect(resolved.map((p) => p.name)).toEqual(['instance', 'global']);
    });

    it('应该使用 append 策略：全局插件在前', () => {
      const globalPlugin: PluginFactory<TestDraft> = () => ({ name: 'global' });
      const instancePlugin: PluginFactory<TestDraft> = () => ({ name: 'instance' });

      const testManager = new TestablePluginManager(
        bus,
        [instancePlugin],
        [globalPlugin],
        'append',
        filterApi
      );

      const merged = testManager.testMergePluginFactories(
        [instancePlugin],
        [globalPlugin],
        'append'
      );

      // 验证合并后的顺序
      const resolved = testManager.testResolvePluginFactories(merged, filterApi);
      expect(resolved.map((p) => p.name)).toEqual(['global', 'instance']);
    });

    it('应该正确处理多个插件的合并顺序', () => {
      const globalPlugins: PluginFactory<TestDraft>[] = [
        () => ({ name: 'global-1' }),
        () => ({ name: 'global-2' }),
      ];
      const instancePlugins: PluginFactory<TestDraft>[] = [
        () => ({ name: 'instance-1' }),
        () => ({ name: 'instance-2' }),
      ];

      const testManager = new TestablePluginManager(
        bus,
        instancePlugins,
        globalPlugins,
        'prepend',
        filterApi
      );

      // 测试 prepend 策略
      const mergedPrepend = testManager.testMergePluginFactories(
        instancePlugins,
        globalPlugins,
        'prepend'
      );
      const resolvedPrepend = testManager.testResolvePluginFactories(
        mergedPrepend,
        filterApi
      );
      expect(resolvedPrepend.map((p) => p.name)).toEqual([
        'instance-1',
        'instance-2',
        'global-1',
        'global-2',
      ]);

      // 测试 append 策略
      const mergedAppend = testManager.testMergePluginFactories(
        instancePlugins,
        globalPlugins,
        'append'
      );
      const resolvedAppend = testManager.testResolvePluginFactories(
        mergedAppend,
        filterApi
      );
      expect(resolvedAppend.map((p) => p.name)).toEqual([
        'global-1',
        'global-2',
        'instance-1',
        'instance-2',
      ]);
    });

    it('应该在实际初始化时保持合并顺序', async () => {
      const executionOrder: string[] = [];
      const globalPlugin: PluginFactory<TestDraft> = () => ({
        name: 'global',
        async onInit() {
          executionOrder.push('global');
        },
      });
      const instancePlugin: PluginFactory<TestDraft> = () => ({
        name: 'instance',
        async onInit() {
          executionOrder.push('instance');
        },
      });

      // 测试 prepend 策略的实际执行顺序
      manager = new PluginManager(
        bus,
        [instancePlugin],
        [globalPlugin],
        'prepend',
        filterApi
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(executionOrder).toEqual(['instance', 'global']);

      // 清理并测试 append 策略
      manager.dispose();
      executionOrder.length = 0;

      manager = new PluginManager(
        bus,
        [instancePlugin],
        [globalPlugin],
        'append',
        filterApi
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(executionOrder).toEqual(['global', 'instance']);
    });
  });

  describe('插件工厂函数解析', () => {
    it('应该支持直接传入插件对象', async () => {
      const plugin: Plugin<TestDraft> = {
        name: 'direct-plugin',
      };

      manager = new PluginManager(bus, [plugin], [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(manager.isReady('direct-plugin')).toBe(true);
    });

    it('应该支持插件工厂函数', async () => {
      const factory: PluginFactory<TestDraft> = () => ({
        name: 'factory-plugin',
      });

      manager = new PluginManager(bus, [factory], [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(manager.isReady('factory-plugin')).toBe(true);
    });

    it('应该支持工厂函数返回 undefined（跳过插件）', async () => {
      const factory: PluginFactory<TestDraft> = () => undefined;

      manager = new PluginManager(bus, [factory], [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(manager.ready).toBe(true);
    });

    it('应该支持工厂函数使用 helpers 添加插件', async () => {
      const factory: PluginFactory<TestDraft> = (helpers) => {
        helpers.push({ name: 'pushed-plugin' });
        return { name: 'factory-plugin' };
      };

      manager = new PluginManager(bus, [factory], [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(manager.isReady('factory-plugin')).toBe(true);
      expect(manager.isReady('pushed-plugin')).toBe(true);
    });

    it('应该支持工厂函数使用 helpers.shift 添加插件到开头', async () => {
      const initOrder: string[] = [];
      const factory: PluginFactory<TestDraft> = (helpers) => {
        helpers.shift({
          name: 'shifted-plugin',
          async onInit() {
            initOrder.push('shifted');
          },
        });
        return {
          name: 'factory-plugin',
          async onInit() {
            initOrder.push('factory');
          },
        };
      };

      manager = new PluginManager(bus, [factory], [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(initOrder).toEqual(['shifted', 'factory']);
    });

    it('应该支持工厂函数使用 helpers.remove 移除插件', async () => {
      const factory: PluginFactory<TestDraft> = (helpers) => {
        helpers.remove('to-remove');
        return { name: 'factory-plugin' };
      };

      const toRemove: Plugin<TestDraft> = { name: 'to-remove' };

      manager = new PluginManager(
        bus,
        [toRemove, factory],
        [],
        'append',
        filterApi
      );
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(manager.isReady('factory-plugin')).toBe(true);
      // to-remove 应该被移除，所以不应该存在
      expect(manager.getState('to-remove')).toBeUndefined();
    });
  });

  describe('插件初始化 (onInit)', () => {
    it('没有 onInit 的插件应该自动标记为就绪', async () => {
      const plugin: Plugin<TestDraft> = {
        name: 'no-init-plugin',
      };

      manager = new PluginManager(bus, [plugin], [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(manager.isReady('no-init-plugin')).toBe(true);
    });

    it('应该正确调用插件的 onInit 方法', async () => {
      const onInitSpy = vi.fn();
      const plugin: Plugin<TestDraft> = {
        name: 'init-plugin',
        async onInit() {
          onInitSpy();
        },
      };

      manager = new PluginManager(bus, [plugin], [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(onInitSpy).toHaveBeenCalledTimes(1);
    });

    it('onInit 应该接收正确的上下文', async () => {
      let receivedContext: any = null;
      const plugin: Plugin<TestDraft> = {
        name: 'context-plugin',
        async onInit(context) {
          receivedContext = context;
        },
      };

      manager = new PluginManager(bus, [plugin], [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(receivedContext).toBeDefined();
      expect(receivedContext.filter).toBe(filterApi);
      expect(receivedContext.pluginManager).toBe(manager);
    });

    it('插件应该自己调用 markReady 标记就绪状态', async () => {
      const readySpy = vi.fn();
      bus.on('plugin:ready', readySpy);

      const plugin: Plugin<TestDraft> = {
        name: 'self-ready-plugin',
        async onInit({ pluginManager }) {
          // 模拟异步初始化
          await new Promise((resolve) => setTimeout(resolve, 10));
          pluginManager.markReady('self-ready-plugin', true);
        },
      };

      manager = new PluginManager(bus, [plugin], [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(readySpy).toHaveBeenCalledWith({
        name: 'self-ready-plugin',
        ready: true,
        error: undefined,
      });
      expect(manager.isReady('self-ready-plugin')).toBe(true);
    });

    it('onInit 抛出异常时应该标记为未就绪', async () => {
      const error = new Error('Init failed');
      const plugin: Plugin<TestDraft> = {
        name: 'error-plugin',
        async onInit() {
          throw error;
        },
      };

      manager = new PluginManager(bus, [plugin], [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(manager.isReady('error-plugin')).toBe(false);
      expect(manager.ready).toBe(false);
    });

    it('onInit 抛出异常时应该触发 plugin:ready 事件', async () => {
      const readySpy = vi.fn();
      bus.on('plugin:ready', readySpy);

      const error = new Error('Init failed');
      const plugin: Plugin<TestDraft> = {
        name: 'error-plugin',
        async onInit() {
          throw error;
        },
      };

      manager = new PluginManager(bus, [plugin], [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(readySpy).toHaveBeenCalledWith({
        name: 'error-plugin',
        ready: false,
        error,
      });
    });
  });

  describe('markReady 方法', () => {
    beforeEach(async () => {
      const plugin: Plugin<TestDraft> = {
        name: 'test-plugin',
      };
      manager = new PluginManager(bus, [plugin], [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    it('应该更新插件就绪状态', () => {
      manager.markReady('test-plugin', true);
      expect(manager.isReady('test-plugin')).toBe(true);
    });

    it('应该触发 plugin:ready 事件', () => {
      const readySpy = vi.fn();
      bus.on('plugin:ready', readySpy);

      manager.markReady('test-plugin', true);

      expect(readySpy).toHaveBeenCalledWith({
        name: 'test-plugin',
        ready: true,
        error: undefined,
      });
    });

    it('应该支持错误信息', () => {
      const error = new Error('Test error');
      manager.markReady('test-plugin', false, error);

      expect(manager.isReady('test-plugin')).toBe(false);
    });

    it('应该触发带错误信息的 plugin:ready 事件', () => {
      const readySpy = vi.fn();
      bus.on('plugin:ready', readySpy);

      const error = new Error('Test error');
      manager.markReady('test-plugin', false, error);

      expect(readySpy).toHaveBeenCalledWith({
        name: 'test-plugin',
        ready: false,
        error,
      });
    });
  });

  describe('isReady 方法', () => {
    beforeEach(async () => {
      const plugins: Plugin<TestDraft>[] = [
        { name: 'plugin-1' },
        { name: 'plugin-2' },
      ];
      manager = new PluginManager(bus, plugins, [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    it('应该正确检查插件就绪状态', () => {
      expect(manager.isReady('plugin-1')).toBe(true);
      expect(manager.isReady('plugin-2')).toBe(true);
    });

    it('应该返回 false 对于不存在的插件', () => {
      expect(manager.isReady('non-existent')).toBe(false);
    });

    it('应该正确反映 markReady 的状态变化', () => {
      manager.markReady('plugin-1', false);
      expect(manager.isReady('plugin-1')).toBe(false);

      manager.markReady('plugin-1', true);
      expect(manager.isReady('plugin-1')).toBe(true);
    });
  });

  describe('ready getter', () => {
    it('所有插件就绪时应该返回 true', async () => {
      const plugins: Plugin<TestDraft>[] = [
        { name: 'plugin-1' },
        { name: 'plugin-2' },
        { name: 'plugin-3' },
      ];

      manager = new PluginManager(bus, plugins, [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(manager.ready).toBe(true);
    });

    it('有插件未就绪时应该返回 false', async () => {
      const error = new Error('Init failed');
      const plugins: Plugin<TestDraft>[] = [
        { name: 'plugin-1' },
        {
          name: 'plugin-2',
          async onInit() {
            throw error;
          },
        },
      ];

      manager = new PluginManager(bus, plugins, [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(manager.ready).toBe(false);
    });

    it('应该触发 plugins:ready 事件', async () => {
      const readySpy = vi.fn();
      bus.on('plugins:ready', readySpy);

      const plugins: Plugin<TestDraft>[] = [
        { name: 'plugin-1' },
        { name: 'plugin-2' },
      ];

      manager = new PluginManager(bus, plugins, [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(readySpy).toHaveBeenCalledWith({ ready: true });
    });

    it('插件状态变化时 ready 应该动态更新', async () => {
      const plugin: Plugin<TestDraft> = {
        name: 'dynamic-plugin',
      };

      manager = new PluginManager(bus, [plugin], [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(manager.ready).toBe(true);

      manager.markReady('dynamic-plugin', false);
      expect(manager.ready).toBe(false);

      manager.markReady('dynamic-plugin', true);
      expect(manager.ready).toBe(true);
    });
  });

  describe('setState 和 getState 方法', () => {
    beforeEach(async () => {
      const plugin: Plugin<TestDraft> = {
        name: 'state-plugin',
      };
      manager = new PluginManager(bus, [plugin], [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    it('应该支持设置插件状态', () => {
      manager.setState('state-plugin', { count: 1, name: 'test' });

      const state = manager.getState('state-plugin');
      expect(state).toEqual({ count: 1, name: 'test' });
    });

    it('应该支持使用更新函数设置状态', () => {
      manager.setState('state-plugin', { count: 1 });
      manager.setState('state-plugin', (prev) => ({
        ...prev,
        count: (prev?.count as number || 0) + 1,
      }));

      const state = manager.getState('state-plugin');
      expect(state).toEqual({ count: 2 });
    });

    it('应该支持合并状态对象', () => {
      manager.setState('state-plugin', { a: 1, b: 2 });
      manager.setState('state-plugin', { b: 3, c: 4 });

      const state = manager.getState('state-plugin');
      expect(state).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('对于不存在的插件应该静默失败', () => {
      expect(() => {
        manager.setState('non-existent', { test: 1 });
      }).not.toThrow();

      const state = manager.getState('non-existent');
      expect(state).toBeUndefined();
    });

    it('应该返回响应式状态对象', () => {
      manager.setState('state-plugin', { count: 1 });
      const state1 = manager.getState('state-plugin');
      const state2 = manager.getState('state-plugin');

      // 应该返回同一个响应式对象
      expect(state1).toBe(state2);
    });
  });

  describe('dispose 方法', () => {
    it('应该调用所有插件的 onDestroy 方法', async () => {
      const destroySpy1 = vi.fn();
      const destroySpy2 = vi.fn();

      const plugins: Plugin<TestDraft>[] = [
        { name: 'plugin-1', onDestroy: destroySpy1 },
        { name: 'plugin-2', onDestroy: destroySpy2 },
      ];

      manager = new PluginManager(bus, plugins, [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const result = manager.dispose();

      expect(destroySpy1).toHaveBeenCalledTimes(1);
      expect(destroySpy2).toHaveBeenCalledTimes(1);
      expect(result.errors).toEqual([]);
    });

    it('应该处理 onDestroy 中的错误', async () => {
      const error = new Error('Destroy failed');
      const plugins: Plugin<TestDraft>[] = [
        {
          name: 'error-plugin',
          onDestroy: () => {
            throw error;
          },
        },
        {
          name: 'ok-plugin',
          onDestroy: vi.fn(),
        },
      ];

      manager = new PluginManager(bus, plugins, [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const result = manager.dispose();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        name: 'error-plugin',
        error,
      });
    });

    it('应该触发 plugins:destroyed 事件', async () => {
      const destroyedSpy = vi.fn();
      bus.on('plugins:destroyed', destroyedSpy);

      const plugins: Plugin<TestDraft>[] = [
        { name: 'plugin-1' },
        { name: 'plugin-2' },
      ];

      manager = new PluginManager(bus, plugins, [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 0));

      manager.dispose();

      expect(destroyedSpy).toHaveBeenCalledWith({ errors: [] });
    });

    it('应该清理所有内部状态', async () => {
      const plugin: Plugin<TestDraft> = {
        name: 'cleanup-plugin',
      };

      manager = new PluginManager(bus, [plugin], [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 0));

      manager.setState('cleanup-plugin', { test: 1 });
      expect(manager.getState('cleanup-plugin')).toBeDefined();

      manager.dispose();

      // 清理后应该无法访问状态
      expect(manager.getState('cleanup-plugin')).toBeUndefined();
      expect(manager.isReady('cleanup-plugin')).toBe(false);
    });
  });

  describe('复杂场景', () => {
    it('应该正确处理异步初始化的插件', async () => {
      const initOrder: string[] = [];
      const plugins: Plugin<TestDraft>[] = [
        {
          name: 'async-1',
          async onInit({ pluginManager }) {
            await new Promise((resolve) => setTimeout(resolve, 10));
            initOrder.push('async-1');
            pluginManager.markReady('async-1', true);
          },
        },
        {
          name: 'async-2',
          async onInit({ pluginManager }) {
            await new Promise((resolve) => setTimeout(resolve, 5));
            initOrder.push('async-2');
            pluginManager.markReady('async-2', true);
          },
        },
      ];

      manager = new PluginManager(bus, plugins, [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 30));

      expect(initOrder).toEqual(['async-1', 'async-2']);
      expect(manager.isReady('async-1')).toBe(true);
      expect(manager.isReady('async-2')).toBe(true);
      expect(manager.ready).toBe(true);
    });

    it('应该正确处理插件之间的依赖关系', async () => {
      const executionOrder: string[] = [];
      const plugin2: Plugin<TestDraft> = {
        name: 'plugin-2',
        async onInit({ pluginManager }) {
          await new Promise((resolve) => setTimeout(resolve, 10));
          executionOrder.push('plugin-2');
          pluginManager.markReady('plugin-2', true);
        },
      };
      const plugin1: Plugin<TestDraft> = {
        name: 'depends-on-2',
        async onInit({ pluginManager }) {
          // 等待 plugin-2 就绪
          while (!pluginManager.isReady('plugin-2')) {
            await new Promise((resolve) => setTimeout(resolve, 1));
          }
          executionOrder.push('depends-on-2');
          pluginManager.markReady('depends-on-2', true);
        },
      };

      // plugin-2 应该在 plugin1 之前初始化（因为它在数组中排在前面）
      manager = new PluginManager(bus, [plugin2, plugin1], [], 'append', filterApi);

      // 等待足够的时间让两个插件都完成初始化
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(executionOrder).toEqual(['plugin-2', 'depends-on-2']);
      expect(manager.isReady('plugin-2')).toBe(true);
      expect(manager.isReady('depends-on-2')).toBe(true);
      expect(manager.ready).toBe(true);
    });

    it('应该正确处理大量插件', async () => {
      const plugins: Plugin<TestDraft>[] = Array.from({ length: 100 }, (_, i) => ({
        name: `plugin-${i}`,
      }));

      manager = new PluginManager(bus, plugins, [], 'append', filterApi);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(manager.ready).toBe(true);
      for (let i = 0; i < 100; i++) {
        expect(manager.isReady(`plugin-${i}`)).toBe(true);
      }
    });
  });
});

