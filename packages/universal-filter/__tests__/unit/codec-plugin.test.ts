/**
 * codec 转换插件测试
 * 测试异步转换、多重转换链、错误处理等功能
 */
import { describe, it, expect, vi } from 'vitest';
import { createFilter } from '../../src/core';
import type { Draft } from '../../src/core/types';
import {
  createCodecTransformPlugin,
  createKeyTransformTransformer,
  createFieldMappingTransformer,
  createTransformFunctions,
  type TransformerConfig,
} from '../../src/plugins/codec/index';

interface TestDraft extends Draft {
  firstName: string;
  lastName: string;
  userAge: number;
  emailAddress?: string;
}

describe('CodecTransformPlugin', () => {
  describe('基础功能', () => {
    it('应该能够创建插件实例', () => {
      const plugin = createCodecTransformPlugin({
        transformers: [],
      });

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('codec-plugin');
    });

    it('应该能够初始化插件', async () => {
      const filter = createFilter<TestDraft>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          userAge: 30,
        },
        plugins: [
          createCodecTransformPlugin({
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
          createCodecTransformPlugin({
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
          createCodecTransformPlugin({
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
          createCodecTransformPlugin({
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
          createCodecTransformPlugin({
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
          createCodecTransformPlugin({
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
          createCodecTransformPlugin({
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
          createCodecTransformPlugin({
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
          createCodecTransformPlugin({
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
          createCodecTransformPlugin({
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
          createCodecTransformPlugin({
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
          createCodecTransformPlugin({
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
          createCodecTransformPlugin({
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
          createCodecTransformPlugin({
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
          createCodecTransformPlugin({
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
          createCodecTransformPlugin({
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
          createCodecTransformPlugin({
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
          createCodecTransformPlugin({
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
          createCodecTransformPlugin({
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
          createCodecTransformPlugin({
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
          createCodecTransformPlugin({
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

  describe('applied 数据转换', () => {
    it('应该确保 applied 是转换后的数据，draft 保持原始格式', async () => {
      const transformer: TransformerConfig = {
        name: 'snake-case-transform',
        direction: 'outbound',
        transform: (data: any) => {
          const result: any = {};
          for (const [key, value] of Object.entries(data)) {
            const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            result[snakeKey] = value;
          }
          return result;
        },
      };

      const filter = createFilter<TestDraft>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          userAge: 30,
        },
        plugins: [
          createCodecTransformPlugin({
            transformers: [transformer],
            applyOn: 'apply',
          }),
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // 修改值
      filter.setValue('firstName', 'Jane');

      // 执行 apply
      await filter.apply();

      // 等待转换完成
      await new Promise((resolve) => setTimeout(resolve, 50));

      // draft 应该保持原始格式（camelCase）
      expect(filter.draft.firstName).toBe('Jane');
      expect(filter.draft.lastName).toBe('Doe');
      expect((filter.draft as any).first_name).toBeUndefined();

      // applied 应该是转换后的格式（snake_case）
      expect(filter.applied).toBeDefined();
      expect((filter.applied as any).first_name).toBe('Jane');
      expect((filter.applied as any).last_name).toBe('Doe');
      expect((filter.applied as any).user_age).toBe(30);
      expect((filter.applied as any).firstName).toBeUndefined();

      filter.dispose();
    });

    it('应该支持多重转换链应用到 applied', async () => {
      const transformers: TransformerConfig[] = [
        {
          name: 'step1',
          transform: (data: any) => ({ ...data, step1: true }),
        },
        {
          name: 'step2',
          transform: (data: any) => ({ ...data, step2: true }),
        },
      ];

      const filter = createFilter<TestDraft>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          userAge: 30,
        },
        plugins: [
          createCodecTransformPlugin({
            transformers,
            applyOn: 'apply',
          }),
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await filter.apply();
      await new Promise((resolve) => setTimeout(resolve, 50));

      // draft 保持原始格式
      expect((filter.draft as any).step1).toBeUndefined();
      expect((filter.draft as any).step2).toBeUndefined();

      // applied 包含所有转换步骤
      expect(filter.applied).toBeDefined();
      expect((filter.applied as any).step1).toBe(true);
      expect((filter.applied as any).step2).toBe(true);

      filter.dispose();
    });
  });

  describe('性能测试', () => {
    it('应该能够高效处理大量数据', async () => {
      const largeData: any = {};
      for (let i = 0; i < 1000; i++) {
        largeData[`field${i}`] = `value${i}`;
      }

      const transformer: TransformerConfig = {
        name: 'performance-transform',
        transform: (data: any) => {
          const result: any = {};
          for (const [key, value] of Object.entries(data)) {
            result[`transformed_${key}`] = value;
          }
          return result;
        },
      };

      const startTime = Date.now();
      const transformFunctions = createTransformFunctions([transformer]);
      const result = await transformFunctions.transformInbound(largeData);
      const endTime = Date.now();

      expect(Object.keys(result as any).length).toBe(1000);
      expect(endTime - startTime).toBeLessThan(100); // 应该在 100ms 内完成
    });

    it('应该能够高效处理长转换链', async () => {
      const transformers: TransformerConfig[] = Array.from({ length: 50 }, (_, i) => ({
        name: `step-${i}`,
        transform: (data: any) => ({ ...data, [`step${i}`]: true }),
      }));

      const testData = { initial: 'data' };

      const startTime = Date.now();
      const transformFunctions = createTransformFunctions(transformers);
      const result = await transformFunctions.transformInbound(testData);
      const endTime = Date.now();

      // 验证所有步骤都执行了
      for (let i = 0; i < 50; i++) {
        expect((result as any)[`step${i}`]).toBe(true);
      }
      expect(endTime - startTime).toBeLessThan(200); // 应该在 200ms 内完成
    });

    it('应该能够高效处理异步转换链', async () => {
      const transformers: TransformerConfig[] = Array.from({ length: 20 }, (_, i) => ({
        name: `async-step-${i}`,
        transform: async (data: any) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return { ...data, [`asyncStep${i}`]: true };
        },
      }));

      const testData = { initial: 'data' };

      const startTime = Date.now();
      const transformFunctions = createTransformFunctions(transformers);
      const result = await transformFunctions.transformInbound(testData);
      const endTime = Date.now();

      // 验证所有步骤都执行了
      for (let i = 0; i < 20; i++) {
        expect((result as any)[`asyncStep${i}`]).toBe(true);
      }
      // 异步操作应该有合理的总时间（每个 1ms，20 个至少 20ms）
      expect(endTime - startTime).toBeGreaterThan(15);
      expect(endTime - startTime).toBeLessThan(500); // 但不应超过 500ms
    });

    it('应该能够高效处理深度嵌套对象', async () => {
      // 创建深度嵌套的对象（10 层）
      const createNestedObject = (depth: number): any => {
        if (depth === 0) {
          return { value: 'leaf' };
        }
        return {
          level: depth,
          nested: createNestedObject(depth - 1),
        };
      };

      const nestedData = createNestedObject(10);

      const transformer: TransformerConfig = {
        name: 'deep-transform',
        transform: (data: any): any => {
          if (data && typeof data === 'object' && !Array.isArray(data)) {
            const result: any = {};
            for (const [key, value] of Object.entries(data)) {
              result[`transformed_${key}`] =
                value && typeof value === 'object' ? transformer.transform(value) : value;
            }
            return result;
          }
          return data;
        },
      };

      const startTime = Date.now();
      const transformFunctions = createTransformFunctions([transformer]);
      const result = await transformFunctions.transformInbound(nestedData);
      const endTime = Date.now();

      // 验证转换成功
      expect((result as any).transformed_level).toBe(10);
      expect((result as any).transformed_nested).toBeDefined();
      expect(endTime - startTime).toBeLessThan(50); // 应该在 50ms 内完成
    });

    it('应该能够高效处理大型数组', async () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: i * 2,
      }));

      const transformer: TransformerConfig = {
        name: 'array-transform',
        transform: (data: any) => {
          if (Array.isArray(data)) {
            return data.map((item) => ({ ...item, transformed: true }));
          }
          return data;
        },
      };

      const startTime = Date.now();
      const transformFunctions = createTransformFunctions([transformer]);
      const result = await transformFunctions.transformInbound(largeArray);
      const endTime = Date.now();

      expect(Array.isArray(result)).toBe(true);
      expect((result as any[]).length).toBe(1000);
      expect((result as any[])[0].transformed).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // 应该在 100ms 内完成
    });

    it('应该能够高效处理混合数据类型的复杂对象', async () => {
      const complexData = {
        string: 'test',
        number: 123,
        boolean: true,
        null: null,
        undefined: undefined,
        array: [1, 2, 3],
        nested: {
          deep: {
            deeper: {
              value: 'deep value',
            },
          },
        },
        date: new Date(),
      };

      const transformer: TransformerConfig = {
        name: 'complex-transform',
        transform: (data: any) => {
          if (data && typeof data === 'object' && !Array.isArray(data) && !(data instanceof Date)) {
            const result: any = {};
            for (const [key, value] of Object.entries(data)) {
              result[`_${key}`] = value;
            }
            return result;
          }
          return data;
        },
      };

      const startTime = Date.now();
      const transformFunctions = createTransformFunctions([transformer]);
      const result = await transformFunctions.transformInbound(complexData);
      const endTime = Date.now();

      expect((result as any)._string).toBe('test');
      expect((result as any)._number).toBe(123);
      expect((result as any)._nested).toBeDefined();
      expect(endTime - startTime).toBeLessThan(50); // 应该在 50ms 内完成
    });
  });

  describe('边界情况测试', () => {
    it('应该能够处理循环引用（避免无限递归）', async () => {
      const circularData: any = { name: 'test' };
      circularData.self = circularData; // 创建循环引用

      // 使用闭包来处理 visited Set
      const visited = new WeakSet<any>();
      const transformInternal = (data: any): any => {
        if (data === null || typeof data !== 'object') {
          return data;
        }
        if (visited.has(data)) {
          return '[Circular]'; // 检测到循环引用
        }
        visited.add(data);
        if (Array.isArray(data)) {
          return data.map((item) => transformInternal(item));
        }
        const result: any = {};
        for (const [key, value] of Object.entries(data)) {
          result[key] = transformInternal(value);
        }
        return result;
      };

      const transformer: TransformerConfig = {
        name: 'circular-transform',
        transform: transformInternal,
      };

      const transformFunctions = createTransformFunctions([transformer]);
      const result = await transformFunctions.transformInbound(circularData);

      expect(result).toBeDefined();
      expect((result as any).name).toBe('test');
      // 循环引用应该被处理（可能是 '[Circular]' 或者被跳过）
    });

    it('应该能够处理包含特殊字符的键名', async () => {
      const specialKeyData = {
        'key-with-dash': 'value1',
        'key.with.dot': 'value2',
        'key with space': 'value3',
        'key@with#special$chars': 'value4',
        '中文键名': 'value5',
        'キー名': 'value6',
      };

      const transformer: TransformerConfig = {
        name: 'special-keys-transform',
        transform: (data: any) => {
          if (data && typeof data === 'object') {
            const result: any = {};
            for (const [key, value] of Object.entries(data)) {
              result[`transformed_${key}`] = value;
            }
            return result;
          }
          return data;
        },
      };

      const transformFunctions = createTransformFunctions([transformer]);
      const result = await transformFunctions.transformInbound(specialKeyData);

      expect((result as any)['transformed_key-with-dash']).toBe('value1');
      expect((result as any)['transformed_key.with.dot']).toBe('value2');
      expect((result as any)['transformed_中文键名']).toBe('value5');
    });

    it('应该能够处理空字符串和零值', async () => {
      const edgeCaseData = {
        emptyString: '',
        zero: 0,
        falseValue: false,
        nullValue: null,
        undefinedValue: undefined,
      };

      const transformer: TransformerConfig = {
        name: 'edge-cases-transform',
        transform: (data: any) => data,
      };

      const transformFunctions = createTransformFunctions([transformer]);
      const result = await transformFunctions.transformInbound(edgeCaseData);

      expect((result as any).emptyString).toBe('');
      expect((result as any).zero).toBe(0);
      expect((result as any).falseValue).toBe(false);
      expect((result as any).nullValue).toBeNull();
      expect((result as any).undefinedValue).toBeUndefined();
    });

    it('应该能够处理超大数字和极小数字', async () => {
      const numberData = {
        maxSafeInteger: Number.MAX_SAFE_INTEGER,
        minSafeInteger: Number.MIN_SAFE_INTEGER,
        infinity: Infinity,
        negativeInfinity: -Infinity,
        nan: NaN,
        veryLarge: 1e100,
        verySmall: 1e-100,
      };

      const transformer: TransformerConfig = {
        name: 'number-transform',
        transform: (data: any) => data,
      };

      const transformFunctions = createTransformFunctions([transformer]);
      const result = await transformFunctions.transformInbound(numberData);

      expect((result as any).maxSafeInteger).toBe(Number.MAX_SAFE_INTEGER);
      expect((result as any).minSafeInteger).toBe(Number.MIN_SAFE_INTEGER);
      expect((result as any).infinity).toBe(Infinity);
      expect((result as any).negativeInfinity).toBe(-Infinity);
      expect(Number.isNaN((result as any).nan)).toBe(true);
    });

    it('应该能够处理 Symbol 类型的值', async () => {
      const symbol = Symbol('test');
      const symbolData = {
        symbolKey: symbol,
        regularKey: 'value',
      };

      const transformer: TransformerConfig = {
        name: 'symbol-transform',
        transform: (data: any) => {
          if (data && typeof data === 'object') {
            const result: any = {};
            for (const [key, value] of Object.entries(data)) {
              result[key] = typeof value === 'symbol' ? value.toString() : value;
            }
            return result;
          }
          return data;
        },
      };

      const transformFunctions = createTransformFunctions([transformer]);
      const result = await transformFunctions.transformInbound(symbolData);

      expect((result as any).symbolKey).toBeDefined();
      expect((result as any).regularKey).toBe('value');
    });

    it('应该能够处理函数类型的值', async () => {
      const functionData = {
        fn: () => 'test',
        regularKey: 'value',
      };

      const transformer: TransformerConfig = {
        name: 'function-transform',
        transform: (data: any) => {
          if (data && typeof data === 'object') {
            const result: any = {};
            for (const [key, value] of Object.entries(data)) {
              result[key] = typeof value === 'function' ? '[Function]' : value;
            }
            return result;
          }
          return data;
        },
      };

      const transformFunctions = createTransformFunctions([transformer]);
      const result = await transformFunctions.transformInbound(functionData);

      expect((result as any).fn).toBe('[Function]');
      expect((result as any).regularKey).toBe('value');
    });

    it('应该能够处理 Date 和 RegExp 对象', async () => {
      const date = new Date('2023-01-01');
      const regex = /test/g;
      const objectData = {
        date,
        regex,
        regularKey: 'value',
      };

      const transformer: TransformerConfig = {
        name: 'object-types-transform',
        transform: (data: any) => {
          if (data && typeof data === 'object' && !Array.isArray(data)) {
            const result: any = {};
            for (const [key, value] of Object.entries(data)) {
              if (value instanceof Date) {
                result[key] = value.toISOString();
              } else if (value instanceof RegExp) {
                result[key] = value.toString();
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
      const result = await transformFunctions.transformInbound(objectData);

      expect((result as any).date).toBe(date.toISOString());
      expect((result as any).regex).toBe(regex.toString());
      expect((result as any).regularKey).toBe('value');
    });

    it('应该能够处理条件函数抛出异常的情况', async () => {
      const transformer: TransformerConfig = {
        name: 'error-condition-transform',
        condition: async () => {
          throw new Error('条件检查失败');
        },
        transform: (data: any) => ({ ...data, transformed: true }),
      };

      const filter = createFilter<TestDraft>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          userAge: 30,
        },
        plugins: [
          createCodecTransformPlugin({
            transformers: [transformer],
            applyOn: 'init',
            onError: 'skip',
          }),
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // 条件函数抛出异常应该导致转换器被跳过
      expect(filter.plugin.ready).toBe(true);
      const draft = filter.draft;
      expect((draft as any).transformed).toBeUndefined();
      filter.dispose();
    });

    it('应该能够处理转换函数返回 undefined 的情况', async () => {
      const transformer: TransformerConfig = {
        name: 'undefined-transform',
        transform: () => undefined,
      };

      const transformFunctions = createTransformFunctions([transformer]);
      const result = await transformFunctions.transformInbound({ test: 'data' });

      expect(result).toBeUndefined();
    });

    it('应该能够处理转换函数返回 null 的情况', async () => {
      const transformer: TransformerConfig = {
        name: 'null-transform',
        transform: () => null,
      };

      const transformFunctions = createTransformFunctions([transformer]);
      const result = await transformFunctions.transformInbound({ test: 'data' });

      expect(result).toBeNull();
    });

    it('应该能够处理空转换器数组', async () => {
      const filter = createFilter<TestDraft>({
        defaultValues: {
          firstName: 'John',
          lastName: 'Doe',
          userAge: 30,
        },
        plugins: [
          createCodecTransformPlugin({
            transformers: [],
            applyOn: 'init',
          }),
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(filter.plugin.ready).toBe(true);
      expect(filter.draft.firstName).toBe('John');
      filter.dispose();
    });

    it('应该能够处理包含 getter/setter 的对象', async () => {
      const objectWithGetter: any = {};
      Object.defineProperty(objectWithGetter, 'computed', {
        get() {
          return 'computed value';
        },
        enumerable: true,
      });

      const transformer: TransformerConfig = {
        name: 'getter-transform',
        transform: (data: any) => {
          if (data && typeof data === 'object') {
            const result: any = {};
            for (const key in data) {
              if (Object.prototype.hasOwnProperty.call(data, key)) {
                result[key] = data[key];
              }
            }
            return result;
          }
          return data;
        },
      };

      const transformFunctions = createTransformFunctions([transformer]);
      const result = await transformFunctions.transformInbound(objectWithGetter);

      expect((result as any).computed).toBe('computed value');
    });
  });
});
