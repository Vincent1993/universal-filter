/**
 * 插件集成测试
 * 使用真实的 Formily，测试插件功能
 */
import { describe, it, expect, vi } from 'vitest';
import { createFilter } from '../../src/core/createFilter';
import { createHistoryPlugin } from '../../src/plugins/historyPlugin';
import { createPresetPlugin } from '../../src/plugins/presetPlugin';
import type { Plugin } from '../../src/core/types';

describe('插件集成测试（真实 Formily）', () => {
  describe('Plugin System', () => {
    it('应该支持插件', () => {
      const onInitSpy = vi.fn();
      const plugin: Plugin = {
        name: 'test-plugin',
        onInit: onInitSpy,
      };

      createFilter({
        plugins: [plugin],
      });

      expect(onInitSpy).toHaveBeenCalled();
    });

    it('应该按顺序执行多个插件', async () => {
      const order: number[] = [];

      const plugin1: Plugin = {
        name: 'plugin1',
        onInit: ({ setReady }) => {
          order.push(1);
          setReady(true);
        },
      };

      const plugin2: Plugin = {
        name: 'plugin2',
        onInit: ({ setReady }) => {
          order.push(2);
          setReady(true);
        },
      };

      const filter = createFilter({
        plugins: [plugin1, plugin2],
      });

      // 等待插件初始化完成
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(order).toEqual([1, 2]);
    });

    it('应该能在插件中访问 filter 实例', () => {
      let capturedFilter: any = null;

      const plugin: Plugin = {
        name: 'capture-plugin',
        onInit: ({ root }) => {
          capturedFilter = root;
        },
      };

      const filter = createFilter({
        plugins: [plugin],
      });

      expect(capturedFilter).toBe(filter);
    });

    it('应该支持工厂函数插件', async () => {
      const order: number[] = [];

      createFilter({
        plugins: [
          ({ root }) => {
            expect(root).toBeDefined();
            return {
              name: 'factory-plugin',
              onInit: ({ setReady }) => {
                order.push(1);
                setReady(true);
              },
            };
          },
        ],
      });

      // 等待插件初始化完成
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(order).toEqual([1]);
    });

    it('工厂函数应该能使用 push 添加插件到末尾', async () => {
      const order: number[] = [];

      createFilter({
        plugins: [
          {
            name: 'plugin1',
            onInit: ({ setReady }) => {
              order.push(1);
              setReady(true);
            },
          },
          ({ push }) => {
            // push 会将插件添加到当前插件数组的末尾
            // 但在工厂函数返回之前就已经添加了
            push({
              name: 'plugin-added',
              onInit: ({ setReady }) => {
                order.push(3);
                setReady(true);
              },
            });
            return {
              name: 'plugin2',
              onInit: ({ setReady }) => {
                order.push(2);
                setReady(true);
              },
            };
          },
          {
            name: 'plugin3',
            onInit: ({ setReady }) => {
              order.push(4);
              setReady(true);
            },
          },
        ],
      });

      // 等待插件初始化完成
      await new Promise(resolve => setTimeout(resolve, 50));

      // 实际执行顺序：plugin1, plugin-added(通过push添加), plugin2(工厂函数返回), plugin3
      expect(order).toEqual([1, 3, 2, 4]);
    });

    it('工厂函数应该能使用 shift 添加插件到开头', async () => {
      const order: number[] = [];

      createFilter({
        plugins: [
          {
            name: 'plugin1',
            onInit: ({ setReady }) => {
              order.push(2);
              setReady(true);
            },
          },
          ({ shift }) => {
            shift({
              name: 'plugin-shifted',
              onInit: ({ setReady }) => {
                order.push(1);
                setReady(true);
              },
            });
            return {
              name: 'plugin2',
              onInit: ({ setReady }) => {
                order.push(3);
                setReady(true);
              },
            };
          },
        ],
      });

      // 等待插件初始化完成
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(order).toEqual([1, 2, 3]);
    });

    it('工厂函数应该能使用 remove 移除插件', async () => {
      const order: number[] = [];

      createFilter({
        plugins: [
          {
            name: 'plugin-to-remove',
            onInit: ({ setReady }) => {
              order.push(999); // 不应该被调用
              setReady(true);
            },
          },
          ({ remove }) => {
            remove('plugin-to-remove');
            return {
              name: 'plugin2',
              onInit: ({ setReady }) => {
                order.push(1);
                setReady(true);
              },
            };
          },
        ],
      });

      // 等待插件初始化完成
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(order).toEqual([1]);
    });

    it('工厂函数可以不返回插件', async () => {
      const order: number[] = [];

      createFilter({
        plugins: [
          {
            name: 'plugin1',
            onInit: ({ setReady }) => {
              order.push(1);
              setReady(true);
            },
          },
          ({ push }) => {
            push({
              name: 'plugin-pushed',
              onInit: ({ setReady }) => {
                order.push(2);
                setReady(true);
              },
            });
            // 不返回插件
          },
        ],
      });

      // 等待插件初始化完成
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(order).toEqual([1, 2]);
    });
  });

  describe('History Plugin', () => {
    it('应该能创建历史插件', () => {
      const plugin = createHistoryPlugin({
        limit: 10,
      });

      expect(plugin.name).toBe('history-plugin');
      expect(plugin.onInit).toBeDefined();
    });

    it('应该集成到 filter 中', () => {
      const filter = createFilter<{ name: string }>({
        defaultValues: { name: 'John' },
        plugins: [createHistoryPlugin()],
      });

      expect(filter).toBeDefined();
      expect(filter.draft.name).toBe('John');
    });
  });

  describe('Preset Plugin', () => {
    it('应该能创建预设插件', () => {
      const plugin = createPresetPlugin({
        initialPresets: [
          { id: 'preset1', name: 'Preset 1', values: { name: 'Preset 1' }, updatedAt: Date.now() },
        ],
      });

      expect(plugin.name).toBe('preset-plugin');
      expect(plugin.onInit).toBeDefined();
    });

    it('应该集成到 filter 中', () => {
      const filter = createFilter<{ name: string }>({
        defaultValues: { name: 'John' },
        plugins: [createPresetPlugin()],
      });

      expect(filter).toBeDefined();
    });
  });

  describe('Plugin Lifecycle', () => {
    it('应该调用 onInit', () => {
      const onInitSpy = vi.fn();

      const plugin: Plugin = {
        name: 'init-plugin',
        onInit: onInitSpy,
      };

      createFilter({
        plugins: [plugin],
      });

      expect(onInitSpy).toHaveBeenCalled();
    });

    it('应该调用 onDestroy', () => {
      const onDestroySpy = vi.fn();

      const plugin: Plugin = {
        name: 'destroy-plugin',
        onDestroy: onDestroySpy,
      };

      const filter = createFilter({
        plugins: [plugin],
      });

      filter.dispose();

      expect(onDestroySpy).toHaveBeenCalled();
    });

    it('插件可以通过事件总线监听事件', async () => {
      const applySpy = vi.fn();

      const plugin: Plugin = {
        name: 'event-plugin',
        onInit: ({ bus }) => {
          bus.on('apply:success', applySpy);
        },
      };

      const filter = createFilter({
        plugins: [plugin],
      });

      await filter.apply();

      expect(applySpy).toHaveBeenCalled();
    });
  });
});




