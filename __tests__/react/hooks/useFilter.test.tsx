/**
 * useFilter Hook 测试
 *
 * 测试范围：
 * 1. 基础功能：实例获取、属性访问、方法调用
 * 2. 错误处理：无实例、命名空间不存在
 * 3. 直接传入实例
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, renderHookWithFilter, createTestFilter, createNestedWrapper } from '../../test-utils';
import { useFilter } from '../../../src/hooks/useFilter';
import type { FilterApi } from '../../../src/core/types';

describe('useFilter Hook', () => {
  // ==================== 共享实例 ====================
  let sharedFilter: FilterApi<{ name: string }>;

  beforeEach(() => {
    // 每个 describe 块前创建共享实例
    sharedFilter = createTestFilter({ name: 'Shared' });
  });

  // ==================== 基础功能测试 ====================

  describe('基础功能', () => {
    it('应该返回 filter 实例', () => {

      const { result } = renderHookWithFilter(() => useFilter(), { filterInstance: sharedFilter });

      expect(result.current).toBe(sharedFilter);
    });

    it('应该能访问 filter 的所有属性', () => {
      const { result } = renderHookWithFilter(() => useFilter<{ name: string }>(), {
        filterInstance: sharedFilter,
      });

      expect(result.current.draft).toEqual({ name: 'Shared' });
      expect(result.current.form).toBeDefined();
      expect(typeof result.current.apply).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });

    it('应该能调用 filter 方法', async () => {
      const { result } = renderHookWithFilter(() => useFilter<{ name: string }>(), {
        filterInstance: sharedFilter,
      });

      // 修改值
      result.current.form.setValues({ name: 'Jane' });
      expect(result.current.draft.name).toBe('Jane');

      // 应用
      await result.current.apply();
      expect(result.current.applied?.name).toBe('Jane');

      // 重置
      result.current.reset();
      expect(result.current.draft.name).toBe('Shared');
    });
  });

  // ==================== Registry 管理测试 ====================

  describe('Registry 管理', () => {
    it('应该从默认 registry 获取实例', () => {
      const { result } = renderHookWithFilter(() => useFilter(), {
        filterInstance: sharedFilter,
      });

      expect(result.current).toBe(sharedFilter);
    });

    it('应该通过 namespace 获取指定实例', () => {
      const nsFilter = createTestFilter({ name: 'Namespaced' });

      const { result } = renderHookWithFilter(
        () => useFilter({ namespace: 'my-namespace' }),
        {
          filterInstance: nsFilter,
          namespace: 'my-namespace',
        }
      );

      expect(result.current).toBe(nsFilter);
      expect(result.current.draft.name).toBe('Namespaced');
    });

    it('应该支持多个命名空间实例', () => {
      const filter1 = createTestFilter({ name: 'NS1' });
      const filter2 = createTestFilter({ name: 'NS2' });

      const wrapper = createNestedWrapper([
        { instance: filter1, namespace: 'ns1' },
        { instance: filter2, namespace: 'ns2' },
      ]);

      const { result: result1 } = renderHook(
        () => useFilter({ namespace: 'ns1' }),
        { wrapper }
      );

      const { result: result2 } = renderHook(
        () => useFilter({ namespace: 'ns2' }),
        { wrapper }
      );

      expect(result1.current).toBe(filter1);
      expect(result1.current.draft.name).toBe('NS1');

      expect(result2.current).toBe(filter2);
      expect(result2.current.draft.name).toBe('NS2');
    });
  });

  // ==================== 嵌套 Provider 测试 ====================

  describe('嵌套 Provider', () => {
    it('应该返回最内层的默认实例', () => {
      const outer = createTestFilter({ name: 'Outer' });
      const inner = createTestFilter({ name: 'Inner' });

      const wrapper = createNestedWrapper([
        { instance: outer },
        { instance: inner },
      ]);

      const { result } = renderHook(() => useFilter(), { wrapper });

      expect(result.current).toBe(inner);
      expect(result.current.draft.name).toBe('Inner');
    });

    it('应该通过 namespace 访问外层实例', () => {
      const outer = createTestFilter({ name: 'Outer' });
      const inner = createTestFilter({ name: 'Inner' });

      const wrapper = createNestedWrapper([
        { instance: outer, namespace: 'outer' },
        { instance: inner },
      ]);

      const { result } = renderHook(
        () => useFilter({ namespace: 'outer' }),
        { wrapper }
      );

      expect(result.current).toBe(outer);
      expect(result.current.draft.name).toBe('Outer');
    });

    it('应该支持三层嵌套', () => {
      const level1 = createTestFilter({ name: 'Level1' });
      const level2 = createTestFilter({ name: 'Level2' });
      const level3 = createTestFilter({ name: 'Level3' });

      const wrapper = createNestedWrapper([
        { instance: level1, namespace: 'level1' },
        { instance: level2, namespace: 'level2' },
        { instance: level3, namespace: 'level3' },
      ]);

      const { result: r1 } = renderHook(
        () => useFilter({ namespace: 'level1' }),
        { wrapper }
      );
      const { result: r2 } = renderHook(
        () => useFilter({ namespace: 'level2' }),
        { wrapper }
      );
      const { result: r3 } = renderHook(
        () => useFilter({ namespace: 'level3' }),
        { wrapper }
      );

      expect(r1.current.draft.name).toBe('Level1');
      expect(r2.current.draft.name).toBe('Level2');
      expect(r3.current.draft.name).toBe('Level3');
    });
  });

  // ==================== 直接传入实例测试 ====================

  describe('直接传入实例', () => {
    it('应该优先使用直接传入的实例', () => {
      const providedFilter = createTestFilter({ name: 'Provided' });
      const directFilter = createTestFilter({ name: 'Direct' });

      const { result } = renderHookWithFilter(
        () => useFilter({ instance: directFilter }),
        { filterInstance: providedFilter }
      );

      // 应该使用直接传入的实例，而不是 Provider 提供的
      expect(result.current).toBe(directFilter);
      expect(result.current.draft.name).toBe('Direct');
    });

    it('应该绕过 Provider 和 registry', () => {
      const directFilter = createTestFilter({ name: 'Direct' });

      // 不使用 Provider，直接传入实例
      const { result } = renderHook(() => useFilter({ instance: directFilter }));

      expect(result.current).toBe(directFilter);
      expect(result.current.draft.name).toBe('Direct');
    });
  });

  // ==================== 错误处理测试 ====================

  describe('错误处理', () => {
    it('应该在没有 Provider 时抛出错误', () => {
      expect(() => {
        renderHook(() => useFilter());
      }).toThrow('未找到可用的 Filter 实例');
    });

    it('应该在 namespace 不存在时抛出错误', () => {
      const { result } = renderHookWithFilter(
        () => {
          try {
            return useFilter({ namespace: 'non-existent' });
          } catch (error) {
            return error as Error;
          }
        },
        { filterInstance: sharedFilter }
      );

      expect(result.current).toBeInstanceOf(Error);
      expect((result.current as Error).message).toContain('未注册');
    });
  });

  // ==================== 响应式更新测试 ====================

  describe('响应式更新', () => {
    it('应该响应 draft 变化', () => {
      const { result } = renderHookWithFilter(() => useFilter<{ name: string }>(), {
        filterInstance: sharedFilter,
      });

      const initialName = result.current.draft.name;
      expect(initialName).toBe('Shared');

      // 修改 draft
      result.current.form.setValues({ name: 'Updated' });

      // 验证更新
      expect(result.current.draft.name).toBe('Updated');
    });

    it('应该响应 applied 变化', async () => {
      const { result } = renderHookWithFilter(() => useFilter<{ name: string }>(), {
        filterInstance: sharedFilter,
      });

      // 初始 applied 为空
      expect(result.current.applied).toBeUndefined();

      // 修改并应用
      result.current.form.setValues({ name: 'Applied' });
      await result.current.apply();

      // 验证 applied 更新
      expect(result.current.applied?.name).toBe('Applied');
    });
  });

  // ==================== 实例稳定性测试 ====================

  describe('实例稳定性', () => {
    it('应该在多次渲染中返回同一实例', () => {
      const { result, rerender } = renderHookWithFilter(() => useFilter(), {
        filterInstance: sharedFilter,
      });

      const firstInstance = result.current;

      rerender();

      const secondInstance = result.current;

      expect(secondInstance).toBe(firstInstance);
    });

    it('应该在 Provider 不变时保持实例稳定', () => {
      const { result, rerender } = renderHookWithFilter(() => useFilter(), {
        filterInstance: sharedFilter,
      });

      const instances: FilterApi<{ name: string }>[] = [];

      instances.push(result.current);
      rerender();
      instances.push(result.current);
      rerender();
      instances.push(result.current);

      // 所有实例应该相同
      expect(instances[0]).toBe(instances[1]);
      expect(instances[1]).toBe(instances[2]);
    });
  });
});

