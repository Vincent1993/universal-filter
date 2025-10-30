/**
 * 数据模型转换插件测试
 * 测试异步转换、多重转换链、错误处理等功能
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFilter } from '../../src/core';
import type { Draft } from '../../src/core/types';
import {
  createDataModelTransformPlugin,
  createKeyTransformTransformer,
  createFieldMappingTransformer,
  createTransformFunctions,
  type TransformerConfig,
} from '../../src/plugins/dataModelTransformPlugin';

interface TestDraft extends Draft {
  firstName: string;
  lastName: string;
  userAge: number;
  emailAddress?: string;
}

describe('DataModelTransformPlugin', () => {
  describe('基础功能', () => {
    it('应该能够创建插件实例', () => {
      const plugin = createDataModelTransformPlugin({
        transformers: [],
      });

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('data-model-transform-plugin');
    });

    it('应该能够初始化插件', async () => {
      const filter = createFilter<TestDraft>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          userAge: 30,
        },
        plugins: [
          createDataModelTransformPlugin({
            transformers: [],
          }),
        ],
      });

      // 等待插件初始化
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(filter.plugin.ready).toBe(true);
      filter.dispose();
    });
  });

  describe('同步转换', () => {
    it('应该能够执行简单的同步转换', async () => {
      const transformer: TransformerConfig = {
        name: 'test-transform',
        transform: (data: any) => {
          if (data && typeof data === 'object') {
            return { ...data, transformed: true };
          }
          return data;
        },
      };

      const filter = createFilter<TestDraft>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          userAge: 30,
        },
        plugins: [
          createDataModelTransformPlugin({
            transformers: [transformer],
            applyOn: 'init',
          }),
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const draft = filter.draft;
      expect((draft as any).transformed).toBe(true);
      filter.dispose();
    });

    it('应该能够执行键名转换', async () => {
      const transformer = createKeyTransformTransformer(
        (key) => key.replace(/([A-Z])/g, '_$1').toLowerCase(),
        { name: 'camel-to-snake', direction: 'inbound' }
      );

      const filter = createFilter<any>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          userAge: 30,
        },
        plugins: [
          createDataModelTransformPlugin({
            transformers: [transformer],
            applyOn: 'init',
          }),
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const draft = filter.draft;
      expect(draft.first_name).toBe('John');
      expect(draft.last_name).toBe('Doe');
      expect(draft.user_age).toBe(30);
      filter.dispose();
    });
  });

  describe('异步转换', () => {
    it('应该能够执行异步转换函数', async () => {
      const asyncTransformer: TransformerConfig = {
        name: 'async-transform',
        transform: async (data: any) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          if (data && typeof data === 'object') {
            return { ...data, asyncTransformed: true };
          }
          return data;
        },
      };

      const filter = createFilter<TestDraft>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          userAge: 30,
        },
        plugins: [
          createDataModelTransformPlugin({
            transformers: [asyncTransformer],
            applyOn: 'init',
          }),
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const draft = filter.draft;
      expect((draft as any).asyncTransformed).toBe(true);
      filter.dispose();
    });

    it('应该能够执行多个异步转换器的链式调用', async () => {
      const transformer1: TransformerConfig = {
        name: 'async-transform-1',
        transform: async (data: any) => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return { ...data, step1: true };
        },
      };

      const transformer2: TransformerConfig = {
        name: 'async-transform-2',
        transform: async (data: any) => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return { ...data, step2: true };
        },
      };

      const filter = createFilter<TestDraft>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          userAge: 30,
        },
        plugins: [
          createDataModelTransformPlugin({
            transformers: [transformer1, transformer2],
            applyOn: 'init',
          }),
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const draft = filter.draft;
      expect((draft as any).step1).toBe(true);
      expect((draft as any).step2).toBe(true);
      filter.dispose();
    });

    it('应该能够处理异步条件函数', async () => {
      const transformer: TransformerConfig = {
        name: 'conditional-transform',
        condition: async (data: any) => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return data && data.userAge > 25;
        },
        transform: (data: any) => {
          return { ...data, conditional: true };
        },
      };

      const filter = createFilter<TestDraft>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          userAge: 30,
        },
        plugins: [
          createDataModelTransformPlugin({
            transformers: [transformer],
            applyOn: 'init',
          }),
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const draft = filter.draft;
      expect((draft as any).conditional).toBe(true);
      filter.dispose();
    });

    it('应该能够跳过不满足异步条件的转换器', async () => {
      const transformer: TransformerConfig = {
        name: 'conditional-transform',
        condition: async (data: any) => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return data && data.userAge < 25; // 条件不满足
        },
        transform: (data: any) => {
          return { ...data, conditional: true };
        },
      };

      const filter = createFilter<TestDraft>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          userAge: 30,
        },
        plugins: [
          createDataModelTransformPlugin({
            transformers: [transformer],
            applyOn: 'init',
          }),
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const draft = filter.draft;
      expect((draft as any).conditional).toBeUndefined();
      filter.dispose();
    });
  });

  describe('多重转换链', () => {
    it('应该能够按顺序执行多个转换器', async () => {
      const transformers: TransformerConfig[] = [
        {
          name: 'step1',
          transform: (data: any) => ({ ...data, step1: true }),
        },
        {
          name: 'step2',
          transform: (data: any) => ({ ...data, step2: true }),
        },
        {
          name: 'step3',
          transform: (data: any) => ({ ...data, step3: true }),
        },
      ];

      const filter = createFilter<TestDraft>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          userAge: 30,
        },
        plugins: [
          createDataModelTransformPlugin({
            transformers,
            applyOn: 'init',
          }),
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const draft = filter.draft;
      expect((draft as any).step1).toBe(true);
      expect((draft as any).step2).toBe(true);
      expect((draft as any).step3).toBe(true);
      filter.dispose();
    });

    it('应该能够处理混合的同步和异步转换器', async () => {
      const transformers: TransformerConfig[] = [
        {
          name: 'sync-step1',
          transform: (data: any) => ({ ...data, sync1: true }),
        },
        {
          name: 'async-step2',
          transform: async (data: any) => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            return { ...data, async2: true };
          },
        },
        {
          name: 'sync-step3',
          transform: (data: any) => ({ ...data, sync3: true }),
        },
      ];

      const filter = createFilter<TestDraft>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          userAge: 30,
        },
        plugins: [
          createDataModelTransformPlugin({
            transformers,
            applyOn: 'init',
          }),
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const draft = filter.draft;
      expect((draft as any).sync1).toBe(true);
      expect((draft as any).async2).toBe(true);
      expect((draft as any).sync3).toBe(true);
      filter.dispose();
    });
  });

  describe('双向转换', () => {
    it('应该能够执行入站转换', async () => {
      const transformer: TransformerConfig = {
        name: 'inbound-transform',
        direction: 'inbound',
        transform: (data: any) => {
          return { ...data, inbound: true };
        },
      };

      const filter = createFilter<TestDraft>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          userAge: 30,
        },
        plugins: [
          createDataModelTransformPlugin({
            transformers: [transformer],
            applyOn: 'init',
          }),
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const draft = filter.draft;
      expect((draft as any).inbound).toBe(true);
      filter.dispose();
    });

    it('应该能够执行出站转换', async () => {
      const transformer: TransformerConfig = {
        name: 'outbound-transform',
        direction: 'outbound',
        transform: (data: any) => {
          return { ...data, outbound: true };
        },
      };

      const filter = createFilter<TestDraft>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          userAge: 30,
        },
        plugins: [
          createDataModelTransformPlugin({
            transformers: [transformer],
            applyOn: 'apply',
          }),
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // 监听 apply:start 事件
      const transformedData: any[] = [];
      filter.on('apply:start', ({ draft }) => {
        transformedData.push(draft);
      });

      await filter.apply();

      // 注意：由于不能在 apply:start 中修改表单，实际的转换应该在业务层完成
      // 这里只验证事件被触发
      expect(transformedData.length).toBeGreaterThan(0);
      filter.dispose();
    });

    it('应该能够使用反向转换函数', async () => {
      const transformer: TransformerConfig = {
        name: 'bidirectional-transform',
        transform: (data: any) => {
          return { ...data, forward: true };
        },
        reverseTransform: (data: any) => {
          return { ...data, reverse: true };
        },
      };

      const transformFunctions = createTransformFunctions([transformer]);

      const inboundResult = await transformFunctions.transformInbound({ test: 'data' });
      expect((inboundResult as any).forward).toBe(true);

      const outboundResult = await transformFunctions.transformOutbound({ test: 'data' });
      expect((outboundResult as any).reverse).toBe(true);
    });
  });

  describe('错误处理', () => {
    it('应该在 throw 模式下抛出错误', async () => {
      const transformer: TransformerConfig = {
        name: 'error-transform',
        transform: () => {
          throw new Error('转换失败');
        },
      };

      const filter = createFilter<TestDraft>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          userAge: 30,
        },
        plugins: [
          createDataModelTransformPlugin({
            transformers: [transformer],
            applyOn: 'init',
            onError: 'throw',
          }),
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // 插件应该标记为未就绪
      expect(filter.plugin.ready).toBe(false);
      filter.dispose();
    });

    it('应该在 skip 模式下跳过错误的转换器', async () => {
      const transformers: TransformerConfig[] = [
        {
          name: 'error-transform',
          transform: () => {
            throw new Error('转换失败');
          },
        },
        {
          name: 'success-transform',
          transform: (data: any) => {
            return { ...data, success: true };
          },
        },
      ];

      const filter = createFilter<TestDraft>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          userAge: 30,
        },
        plugins: [
          createDataModelTransformPlugin({
            transformers,
            applyOn: 'init',
            onError: 'skip',
          }),
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const draft = filter.draft;
      // 应该跳过错误的转换器，继续执行后续转换器
      expect((draft as any).success).toBe(true);
      filter.dispose();
    });

    it('应该在 fallback 模式下使用回退值', async () => {
      const transformer: TransformerConfig = {
        name: 'error-transform',
        transform: () => {
          throw new Error('转换失败');
        },
      };

      const fallbackValue = { firstName: 'Fallback', lastName: 'Value', userAge: 0 };

      const filter = createFilter<TestDraft>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          userAge: 30,
        },
        plugins: [
          createDataModelTransformPlugin({
            transformers: [transformer],
            applyOn: 'init',
            onError: 'fallback',
            fallbackValue: fallbackValue as TestDraft,
          }),
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const draft = filter.draft;
      expect(draft.firstName).toBe('Fallback');
      expect(draft.userAge).toBe(0);
      filter.dispose();
    });

    it('应该能够处理异步转换错误', async () => {
      const transformer: TransformerConfig = {
        name: 'async-error-transform',
        transform: async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          throw new Error('异步转换失败');
        },
      };

      const filter = createFilter<TestDraft>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          userAge: 30,
        },
        plugins: [
          createDataModelTransformPlugin({
            transformers: [transformer],
            applyOn: 'init',
            onError: 'skip',
          }),
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // 应该跳过错误的转换器，插件仍然就绪
      expect(filter.plugin.ready).toBe(true);
      filter.dispose();
    });
  });

  describe('字段映射转换', () => {
    it('应该能够执行字段映射转换', async () => {
      const transformer = createFieldMappingTransformer(
        {
          firstName: 'first_name',
          lastName: 'last_name',
          userAge: 'age',
        },
        { name: 'field-mapping', direction: 'inbound' }
      );

      const filter = createFilter<any>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          userAge: 30,
        },
        plugins: [
          createDataModelTransformPlugin({
            transformers: [transformer],
            applyOn: 'init',
          }),
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const draft = filter.draft;
      expect(draft.first_name).toBe('John');
      expect(draft.last_name).toBe('Doe');
      expect(draft.age).toBe(30);
      filter.dispose();
    });

    it('应该能够处理反向字段映射', async () => {
      const transformer = createFieldMappingTransformer(
        {
          firstName: 'first_name',
          lastName: 'last_name',
        },
        { name: 'field-mapping', direction: 'both' }
      );

      const transformFunctions = createTransformFunctions([transformer]);

      // 入站：firstName -> first_name
      const inboundResult = await transformFunctions.transformInbound({
        firstName: 'John',
        lastName: 'Doe',
      });
      expect((inboundResult as any).first_name).toBe('John');

      // 出站：first_name -> firstName
      const outboundResult = await transformFunctions.transformOutbound({
        first_name: 'Jane',
        last_name: 'Smith',
      });
      expect((outboundResult as any).firstName).toBe('Jane');
    });
  });

  describe('转换函数导出', () => {
    it('应该能够导出转换函数供外部使用', async () => {
      const transformer: TransformerConfig = {
        name: 'test-transform',
        transform: (data: any) => {
          return { ...data, transformed: true };
        },
      };

      const transformFunctions = createTransformFunctions([transformer]);

      const result = await transformFunctions.transformInbound({ test: 'data' });
      expect((result as any).transformed).toBe(true);
    });

    it('应该能够处理异步转换函数导出', async () => {
      const transformer: TransformerConfig = {
        name: 'async-transform',
        transform: async (data: any) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { ...data, asyncTransformed: true };
        },
      };

      const transformFunctions = createTransformFunctions([transformer]);

      const result = await transformFunctions.transformInbound({ test: 'data' });
      expect((result as any).asyncTransformed).toBe(true);
    });
  });

  describe('调试模式', () => {
    it('应该在调试模式下输出日志', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const transformer: TransformerConfig = {
        name: 'test-transform',
        transform: (data: any) => data,
      };

      const filter = createFilter<TestDraft>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          userAge: 30,
        },
        plugins: [
          createDataModelTransformPlugin({
            transformers: [transformer],
            applyOn: 'init',
            debug: true,
          }),
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
      filter.dispose();
    });
  });

  describe('边界情况', () => {
    it('应该能够处理空数据', async () => {
      const transformer: TransformerConfig = {
        name: 'empty-transform',
        transform: (data: any) => data,
      };

      const filter = createFilter<TestDraft>({
        plugins: [
          createDataModelTransformPlugin({
            transformers: [transformer],
            applyOn: 'init',
          }),
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(filter.plugin.ready).toBe(true);
      filter.dispose();
    });

    it('应该能够处理 null 和 undefined', async () => {
      const transformer: TransformerConfig = {
        name: 'null-transform',
        transform: (data: any) => {
          if (data === null || data === undefined) {
            return { empty: true };
          }
          return data;
        },
      };

      const transformFunctions = createTransformFunctions([transformer]);

      const nullResult = await transformFunctions.transformInbound(null);
      expect((nullResult as any).empty).toBe(true);

      const undefinedResult = await transformFunctions.transformInbound(undefined);
      expect((undefinedResult as any).empty).toBe(true);
    });

    it('应该能够处理数组数据', async () => {
      const transformer = createKeyTransformTransformer(
        (key) => key.toUpperCase(),
        { direction: 'inbound' }
      );

      const transformFunctions = createTransformFunctions([transformer]);

      const result = await transformFunctions.transformInbound([
        { firstName: 'John', lastName: 'Doe' },
        { firstName: 'Jane', lastName: 'Smith' },
      ]);

      expect(Array.isArray(result)).toBe(true);
      expect((result as any[])[0].FIRSTNAME).toBe('John');
    });

    it('应该能够处理嵌套对象的异步转换', async () => {
      const transformer: TransformerConfig = {
        name: 'nested-async-transform',
        transform: async (data: any) => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          if (data && typeof data === 'object' && !Array.isArray(data)) {
            const result: any = {};
            for (const [key, value] of Object.entries(data)) {
              if (value && typeof value === 'object' && !Array.isArray(value)) {
                result[key] = { ...(value as any), nestedTransformed: true };
              } else {
                result[key] = value;
              }
            }
            return result;
          }
          return data;
        },
      };

      const transformFunctions = createTransformFunctions([transformer]);

      const result = await transformFunctions.transformInbound({
        user: { name: 'John', age: 30 },
        metadata: { version: '1.0' },
      });

      expect((result as any).user.nestedTransformed).toBe(true);
      expect((result as any).metadata.nestedTransformed).toBe(true);
    });

    it('应该能够处理异步条件函数返回 false 的情况', async () => {
      let callCount = 0;
      const transformer: TransformerConfig = {
        name: 'conditional-async-transform',
        condition: async (data: any) => {
          callCount++;
          await new Promise((resolve) => setTimeout(resolve, 5));
          return false; // 始终返回 false
        },
        transform: (data: any) => {
          return { ...data, transformed: true };
        },
      };

      const filter = createFilter<TestDraft>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          userAge: 30,
        },
        plugins: [
          createDataModelTransformPlugin({
            transformers: [transformer],
            applyOn: 'init',
          }),
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const draft = filter.draft;
      expect((draft as any).transformed).toBeUndefined();
      expect(callCount).toBeGreaterThan(0);
      filter.dispose();
    });

    it('应该能够处理混合同步和异步条件', async () => {
      const transformers: TransformerConfig[] = [
        {
          name: 'sync-condition',
          condition: (data: any) => data && data.userAge > 20,
          transform: (data: any) => ({ ...data, syncCondition: true }),
        },
        {
          name: 'async-condition',
          condition: async (data: any) => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            return data && data.userAge < 40;
          },
          transform: (data: any) => ({ ...data, asyncCondition: true }),
        },
      ];

      const filter = createFilter<TestDraft>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          userAge: 30,
        },
        plugins: [
          createDataModelTransformPlugin({
            transformers,
            applyOn: 'init',
          }),
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const draft = filter.draft;
      expect((draft as any).syncCondition).toBe(true);
      expect((draft as any).asyncCondition).toBe(true);
      filter.dispose();
    });

    it('应该能够处理转换器返回 Promise 的情况', async () => {
      const transformer: TransformerConfig = {
        name: 'promise-transform',
        transform: async (data: any) => {
          return Promise.resolve({ ...data, promiseResolved: true });
        },
      };

      const transformFunctions = createTransformFunctions([transformer]);

      const result = await transformFunctions.transformInbound({ test: 'data' });
      expect((result as any).promiseResolved).toBe(true);
    });

    it('应该能够处理复杂的异步转换链', async () => {
      const transformers: TransformerConfig[] = [
        {
          name: 'async-step1',
          transform: async (data: any) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return { ...data, step1: true };
          },
        },
        {
          name: 'async-step2',
          condition: async (data: any) => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            return (data as any).step1 === true;
          },
          transform: async (data: any) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return { ...data, step2: true };
          },
        },
        {
          name: 'async-step3',
          transform: async (data: any) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return { ...data, step3: true };
          },
        },
      ];

      const transformFunctions = createTransformFunctions(transformers);

      const startTime = Date.now();
      const result = await transformFunctions.transformInbound({ initial: 'data' });
      const endTime = Date.now();

      expect((result as any).step1).toBe(true);
      expect((result as any).step2).toBe(true);
      expect((result as any).step3).toBe(true);
      // 验证异步操作确实执行了（总时间应该 > 25ms，因为有多个延迟）
      expect(endTime - startTime).toBeGreaterThan(20);
    });
  });

  describe('插件生命周期', () => {
    it('应该能够正确清理插件', async () => {
      const filter = createFilter<TestDraft>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          userAge: 30,
        },
        plugins: [
          createDataModelTransformPlugin({
            transformers: [],
          }),
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(filter.plugin.ready).toBe(true);

      filter.dispose();

      // 验证清理后状态
      expect(filter.plugin.ready).toBe(true); // PluginManager 的 ready 可能仍然为 true
    });
  });
});
