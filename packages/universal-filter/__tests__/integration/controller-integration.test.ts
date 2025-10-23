import { describe, it, expect, vi } from 'vitest';
import { FilterController } from '../../src/core/controller';
import type { Draft, Plugin } from '../../src/core/types';

interface TestDraft extends Draft {
  name?: string;
  age?: number;
  email?: string;
  tags?: string[];
  status?: 'active' | 'inactive';
}

describe('FilterController 完整集成测试', () => {
  describe('基础功能验证', () => {
    it('应该成功创建 Filter 实例并包含所有核心 API', () => {
      const filter = new FilterController<TestDraft>();

      // 验证 CoreManager 提供的 API
      expect(filter.id).toBeDefined();
      expect(filter.form).toBeDefined();
      expect(filter.draft).toBeDefined();
      expect(filter.applied).toBeUndefined(); // 初始未 apply
      expect(filter.previous).toBeUndefined();

      // 验证核心方法
      expect(typeof filter.apply).toBe('function');
      expect(typeof filter.reset).toBe('function');
      expect(typeof filter.setValues).toBe('function');
      expect(typeof filter.setValue).toBe('function');
      expect(typeof filter.validate).toBe('function');

      // 验证 PluginManager 命名空间
      expect(filter.plugin).toBeDefined();
      expect(typeof filter.plugin.getPlugins).toBe('function');
      expect(typeof filter.plugin.hasPlugin).toBe('function');
      expect(typeof filter.plugin.getPlugin).toBe('function');
      expect(typeof filter.plugin.getPluginStatuses).toBe('function');
      expect(typeof filter.plugin.setPluginState).toBe('function');
      expect(typeof filter.plugin.getPluginState).toBe('function');
    });

    it('应该正确初始化草稿值和默认值', () => {
      const defaultValues = { name: 'default', age: 0 };
      const initialValues = { name: 'test', age: 20, email: 'test@example.com' };

      const filter = new FilterController<TestDraft>({
        defaultValues,
        values: initialValues,
      });

      expect(filter.draft.name).toBe('test');
      expect(filter.draft.age).toBe(20);
      expect(filter.draft.email).toBe('test@example.com');
      expect(filter.defaultValues).toEqual(defaultValues);
    });
  });

  describe('草稿值操作', () => {
    it('应该支持设置单个字段值', () => {
      const filter = new FilterController<TestDraft>();

      filter.setValue('name', 'John');
      expect(filter.draft.name).toBe('John');

      filter.setValue('age', 30);
      expect(filter.draft.age).toBe(30);
    });

    it('应该支持批量设置值', () => {
      const filter = new FilterController<TestDraft>();

      filter.setValues({
        name: 'Jane',
        age: 25,
        email: 'jane@example.com',
      });

      expect(filter.draft.name).toBe('Jane');
      expect(filter.draft.age).toBe(25);
      expect(filter.draft.email).toBe('jane@example.com');
    });

    it('应该支持删除字段值', () => {
      const filter = new FilterController<TestDraft>({
        values: { name: 'test', age: 20 },
      });

      filter.deleteValue('age');
      expect(filter.draft.age).toBeUndefined();
      expect(filter.draft.name).toBe('test');
    });

    it('应该支持重置到默认值', () => {
      const filter = new FilterController<TestDraft>({
        defaultValues: { name: 'default', age: 0 },
        values: { name: 'changed', age: 100 },
      });

      filter.reset();

      expect(filter.draft.name).toBe('default');
      expect(filter.draft.age).toBe(0);
    });
  });

  describe('Apply 流程', () => {
    it('应该正确执行 apply 流程并创建快照', async () => {
      const filter = new FilterController<TestDraft>({
        values: { name: 'test', age: 20 },
      });

      expect(filter.applied).toBeUndefined();
      expect(filter.previous).toBeUndefined();

      await filter.apply();

      expect(filter.applied).toEqual({ name: 'test', age: 20 });
      expect(filter.previous).toEqual({ name: 'test', age: 20 });
    });

    it('应该在 apply 时触发生命周期监听器', async () => {
      const startHandler = vi.fn();
      const successHandler = vi.fn();

      const filter = new FilterController<TestDraft>({
        values: { name: 'test' },
        listeners: {
          onApplyStart: startHandler,
          onApplySuccess: successHandler,
        },
      });

      await filter.apply();

      expect(startHandler).toHaveBeenCalledWith({ draft: { name: 'test' } });
      expect(successHandler).toHaveBeenCalledWith({
        draft: { name: 'test' },
        payload: { name: 'test' },
      });
    });

    it('应该在值变化时触发 onDraftChange 监听器', () => {
      const changeHandler = vi.fn();
      const filter = new FilterController<TestDraft>({
        values: { name: 'initial' },
        listeners: {
          onDraftChange: changeHandler,
        },
      });

      filter.setValue('name', 'updated');

      expect(changeHandler).toHaveBeenCalled();
      expect(changeHandler.mock.calls[0][0].name).toBe('updated');
    });
  });


  describe('插件系统集成', () => {
    it('应该正确加载和初始化插件', async () => {
      const initSpy = vi.fn();

      const testPlugin: Plugin<TestDraft> = {
        name: 'test-plugin',
        onInit: async (ctx) => {
          initSpy(ctx.root);
          ctx.setReady(true);
        },
      };

      const filter = new FilterController<TestDraft>({
        plugins: [testPlugin],
      });

      await vi.waitFor(() => {
        expect(initSpy).toHaveBeenCalled();
        expect(initSpy.mock.calls[0][0]).toBe(filter);
      });

      // 验证插件已注册
      expect(filter.plugin.count).toBe(1);
    });

    it('应该按依赖顺序初始化多个插件', async () => {
      const executionOrder: string[] = [];

      const pluginA: Plugin<TestDraft> = {
        name: 'plugin-a',
        onInit: async (ctx) => {
          executionOrder.push('A');
          ctx.setReady(true);
        },
      };

      const pluginB: Plugin<TestDraft> = {
        name: 'plugin-b',
        requires: ['plugin-a'],
        onInit: async (ctx) => {
          executionOrder.push('B');
          ctx.setReady(true);
        },
      };

      const pluginC: Plugin<TestDraft> = {
        name: 'plugin-c',
        requires: ['plugin-b'],
        onInit: async (ctx) => {
          executionOrder.push('C');
          ctx.setReady(true);
        },
      };

      new FilterController<TestDraft>({
        plugins: [pluginC, pluginA, pluginB], // 乱序提供
      });

      await vi.waitFor(() => {
        expect(executionOrder).toEqual(['A', 'B', 'C']);
      });
    });

    it('应该按优先级排序插件', async () => {
      const executionOrder: string[] = [];

      const plugin1: Plugin<TestDraft> = {
        name: 'plugin-1',
        priority: 10,
        onInit: async (ctx) => {
          executionOrder.push('1');
          ctx.setReady(true);
        },
      };

      const plugin2: Plugin<TestDraft> = {
        name: 'plugin-2',
        priority: 5,
        onInit: async (ctx) => {
          executionOrder.push('2');
          ctx.setReady(true);
        },
      };

      const plugin3: Plugin<TestDraft> = {
        name: 'plugin-3',
        priority: 15,
        onInit: async (ctx) => {
          executionOrder.push('3');
          ctx.setReady(true);
        },
      };

      new FilterController<TestDraft>({
        plugins: [plugin1, plugin2, plugin3],
      });

      await vi.waitFor(() => {
        expect(executionOrder).toEqual(['2', '1', '3']); // 按 priority 升序
      });
    });

    it('应该正确聚合插件就绪状态', async () => {
      const plugin1: Plugin<TestDraft> = {
        name: 'plugin-1',
        onInit: async (ctx) => {
          setTimeout(() => ctx.setReady(true), 10);
        },
      };

      const plugin2: Plugin<TestDraft> = {
        name: 'plugin-2',
        onInit: async (ctx) => {
          setTimeout(() => ctx.setReady(true), 20);
        },
      };

      const filter = new FilterController<TestDraft>({
        plugins: [plugin1, plugin2],
      });

      await vi.waitFor(
        () => {
          expect(filter.plugin.ready).toBe(true);
          const statuses = filter.plugin.getPluginStatuses();
          expect(statuses.every((s) => s.ready)).toBe(true);
        },
        { timeout: 100 }
      );
    });

    it('插件应该能够访问和操作核心 API', async () => {
      const testPlugin: Plugin<TestDraft> = {
        name: 'core-access-plugin',
        onInit: async (ctx) => {
          // 读取当前值
          const currentName = ctx.root.draft.name;

          // 修改值
          ctx.root.setValue('name', `${currentName || 'default'}-modified`);
          ctx.root.setValue('age', 25);

          // 注意:插件内部不能订阅事件,因为 events 是内部 Bus
          // 实际场景中,插件应该通过 listeners 来响应事件

          ctx.setReady(true);
        },
      };

      const filter = new FilterController<TestDraft>({
        values: { name: 'test' },
        plugins: [testPlugin],
      });

      await vi.waitFor(() => {
        expect(filter.draft.name).toBe('test-modified');
        expect(filter.draft.age).toBe(25);
      });
    });

    it('插件应该能够使用插件状态存储', async () => {
      const stateKey = Symbol('plugin-state');

      const plugin1: Plugin<TestDraft> = {
        name: 'state-writer',
        onInit: async (ctx) => {
          ctx.root.plugin.setPluginState(stateKey, { counter: 0, data: 'test' });
          ctx.setReady(true);
        },
      };

      const plugin2: Plugin<TestDraft> = {
        name: 'state-reader',
        requires: ['state-writer'],
        onInit: async (ctx) => {
          const state = ctx.root.plugin.getPluginState<{ counter: number; data: string }>(stateKey);
          if (state) {
            ctx.root.plugin.setPluginState(stateKey, { ...state, counter: state.counter + 1 });
          }
          ctx.setReady(true);
        },
      };

      const filter = new FilterController<TestDraft>({
        plugins: [plugin1, plugin2],
      });

      await vi.waitFor(() => {
        expect(filter.plugin.ready).toBe(true);
      });

      const finalState = filter.plugin.getPluginState<{ counter: number; data: string }>(stateKey);
      expect(finalState).toEqual({ counter: 1, data: 'test' });
    });
  });

  describe('autoApply 功能', () => {
    it('无插件时应该立即自动应用', async () => {
      const applySuccessHandler = vi.fn();

      const filter = new FilterController<TestDraft>({
        values: { name: 'test', age: 20 },
        autoApply: { onInit: true },
        listeners: {
          onApplySuccess: applySuccessHandler,
        },
      });

      await vi.waitFor(() => {
        expect(applySuccessHandler).toHaveBeenCalled();
        expect(filter.applied).toEqual({ name: 'test', age: 20 });
      });
    });

    it('有插件时应该等待插件就绪后再自动应用', async () => {
      const applySuccessHandler = vi.fn();
      let pluginInitialized = false;

      const slowPlugin: Plugin<TestDraft> = {
        name: 'slow-plugin',
        onInit: async (ctx) => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          pluginInitialized = true;
          ctx.root.setValue('name', 'modified-by-plugin');
          ctx.setReady(true);
        },
      };

      const filter = new FilterController<TestDraft>({
        values: { name: 'initial', age: 20 },
        plugins: [slowPlugin],
        autoApply: { onInit: true },
        listeners: {
          onApplySuccess: applySuccessHandler,
        },
      });

      await vi.waitFor(
        () => {
          expect(applySuccessHandler).toHaveBeenCalled();
          expect(pluginInitialized).toBe(true);
          expect(filter.applied?.name).toBe('modified-by-plugin');
        },
        { timeout: 100 }
      );
    });

    it('禁用 autoApply 时不应自动应用', async () => {
      const applyHandler = vi.fn();

      const filter = new FilterController<TestDraft>({
        values: { name: 'test' },
        autoApply: { onInit: false },
        listeners: {
          onApplySuccess: applyHandler,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(applyHandler).not.toHaveBeenCalled();
      expect(filter.applied).toBeUndefined();
    });
  });

  describe('复杂场景集成测试', () => {
    it('应该支持多插件协同工作流程', async () => {
      const workflow: string[] = [];

      // 数据加载插件
      const dataLoaderPlugin: Plugin<TestDraft> = {
        name: 'data-loader',
        priority: 1,
        onInit: async (ctx) => {
          workflow.push('data-loader:init');
          // 模拟异步加载数据
          await new Promise((resolve) => setTimeout(resolve, 10));
          ctx.root.setValues({ name: 'loaded-name', age: 30 });
          workflow.push('data-loader:complete');
          ctx.setReady(true);
        },
      };

      // 数据验证插件
      const validationPlugin: Plugin<TestDraft> = {
        name: 'validation',
        requires: ['data-loader'],
        priority: 2,
        onInit: async (ctx) => {
          workflow.push('validation:init');
          ctx.setReady(true);
        },
      };

      // 数据转换插件
      const transformPlugin: Plugin<TestDraft> = {
        name: 'transform',
        requires: ['validation'],
        priority: 3,
        onInit: async (ctx) => {
          workflow.push('transform:init');
          ctx.setReady(true);
        },
      };

      const filter = new FilterController<TestDraft>({
        plugins: [transformPlugin, dataLoaderPlugin, validationPlugin],
        autoApply: { onInit: true },
      });

      // 等待插件初始化完成
      await vi.waitFor(
        () => {
          expect(workflow).toContain('data-loader:init');
          expect(workflow).toContain('data-loader:complete');
          expect(workflow).toContain('validation:init');
          expect(workflow).toContain('transform:init');
          expect(filter.plugin.ready).toBe(true);
        },
        { timeout: 200 }
      );

      // 等待 autoApply 完成
      await vi.waitFor(
        () => {
          expect(filter.applied).toBeDefined();
        },
        { timeout: 200 }
      );

      // 验证最终状态
      expect(filter.draft.name).toBe('loaded-name');
      expect(filter.draft.age).toBe(30);
      expect(filter.applied).toEqual({ name: 'loaded-name', age: 30 });
    });

    it('应该处理插件错误并继续运行', async () => {
      const errorPlugin: Plugin<TestDraft> = {
        name: 'error-plugin',
        onInit: async (ctx) => {
          try {
            throw new Error('Plugin initialization failed');
          } catch (err) {
            ctx.setReady(false, err);
          }
        },
      };

      const normalPlugin: Plugin<TestDraft> = {
        name: 'normal-plugin',
        onInit: async (ctx) => {
          ctx.root.setValue('name', 'normal-plugin-value');
          ctx.setReady(true);
        },
      };

      const filter = new FilterController<TestDraft>({
        plugins: [errorPlugin, normalPlugin],
      });

      await vi.waitFor(() => {
        const statuses = filter.plugin.getPluginStatuses();
        const errorStatus = statuses.find((s) => s.name === 'error-plugin');
        const normalStatus = statuses.find((s) => s.name === 'normal-plugin');

        expect(errorStatus?.ready).toBe(false);
        expect(errorStatus?.error).toBeDefined();
        expect(normalStatus?.ready).toBe(true);
        expect(filter.draft.name).toBe('normal-plugin-value');
      });
    });

    it('应该支持监听器与插件混合使用', async () => {
      const events: string[] = [];

      const testPlugin: Plugin<TestDraft> = {
        name: 'test-plugin',
        onInit: async (ctx) => {
          events.push('plugin:init');
          ctx.root.setValue('name', 'plugin-value');
          ctx.setReady(true);
        },
      };

      const filter = new FilterController<TestDraft>({
        plugins: [testPlugin],
        listeners: {
          onInit: () => {
            events.push('listener:onInit');
          },
          onDraftChange: (draft) => {
            events.push(`listener:onDraftChange:${draft.name}`);
          },
          onApplySuccess: () => {
            events.push('listener:onApplySuccess');
          },
        },
        autoApply: { onInit: true },
      });

      await vi.waitFor(
        () => {
          expect(events).toContain('listener:onInit');
          expect(events).toContain('plugin:init');
          expect(events).toContain('listener:onDraftChange:plugin-value');
          expect(events).toContain('listener:onApplySuccess');
        },
        { timeout: 100 }
      );
    });
  });

  describe('边界情况', () => {
    it('应该处理空配置', () => {
      const filter = new FilterController<TestDraft>();
      expect(filter).toBeDefined();
      expect(filter.draft).toEqual({});
    });

    it('应该处理空插件列表', async () => {
      const filter = new FilterController<TestDraft>({
        plugins: [],
      });

      expect(filter.plugin.count).toBe(0);
      expect(filter.plugin.ready).toBe(true);
    });

    it('应该处理插件循环依赖（降级为顺序执行）', async () => {
      const executionOrder: string[] = [];

      const pluginA: Plugin<TestDraft> = {
        name: 'plugin-a',
        requires: ['plugin-b'],
        onInit: async (ctx) => {
          executionOrder.push('A');
          ctx.setReady(true);
        },
      };

      const pluginB: Plugin<TestDraft> = {
        name: 'plugin-b',
        requires: ['plugin-a'],
        onInit: async (ctx) => {
          executionOrder.push('B');
          ctx.setReady(true);
        },
      };

      new FilterController<TestDraft>({
        plugins: [pluginA, pluginB],
      });

      await vi.waitFor(() => {
        expect(executionOrder.length).toBeGreaterThan(0);
      });
    });
  });
});

