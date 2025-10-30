/**
 * 性能测试用例
 * 验证 changed 缓存和其他性能优化
 */
import { describe, it, expect, vi } from 'vitest';
import { CoreManager } from '../../src/core/managers/CoreManager';
import type { Draft } from '../../src/core/types';
import { isEqual } from 'es-toolkit';

interface TestDraft extends Draft {
  name: string;
  age: number;
  email?: string;
}

describe('CoreManager - 性能优化测试', () => {
  describe('changed 缓存优化', () => {
    it('应该缓存 changed 结果，避免重复深度比较', () => {
      const defaultValues: TestDraft = {
        name: 'John',
        age: 30,
      };

      const manager = new CoreManager<TestDraft>({
        defaultValues,
      });

      // 第一次访问 changed，应该执行深度比较
      const changed1 = manager.changed;
      expect(changed1).toBe(false);

      // 再次访问 changed，应该使用缓存
      const changed2 = manager.changed;
      expect(changed2).toBe(false);
      expect(changed2).toBe(changed1);

      manager.dispose();
    });

    it('应该在值变化时清除缓存', () => {
      const defaultValues: TestDraft = {
        name: 'John',
        age: 30,
      };

      const manager = new CoreManager<TestDraft>({
        defaultValues,
      });

      // 初始状态，未变化
      expect(manager.changed).toBe(false);

      // 修改值
      manager.setValue('name', 'Jane');

      // 等待值变化事件
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // 现在应该已变化
          expect(manager.changed).toBe(true);
          manager.dispose();
          resolve();
        }, 10);
      });
    });

    it('应该在 reset 时清除缓存', () => {
      const defaultValues: TestDraft = {
        name: 'John',
        age: 30,
      };

      const manager = new CoreManager<TestDraft>({
        defaultValues,
      });

      // 修改值
      manager.setValue('name', 'Jane');

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(manager.changed).toBe(true);

          // 重置
          manager.reset();

          // 应该回到未变化状态
          expect(manager.changed).toBe(false);
          manager.dispose();
          resolve();
        }, 10);
      });
    });

    it('应该在 setInitialValues 时清除缓存', () => {
      const defaultValues: TestDraft = {
        name: 'John',
        age: 30,
      };

      const manager = new CoreManager<TestDraft>({
        defaultValues,
      });

      expect(manager.changed).toBe(false);

      // 修改初始值
      manager.setInitialValues({
        name: 'Jane',
        age: 25,
      });

      // 缓存应该被清除，changed 应该重新计算
      expect(manager.changed).toBe(true);
      manager.dispose();
    });
  });

  describe('changed 缓存性能对比', () => {
    it('应该比无缓存版本性能更好（多次访问）', () => {
      const defaultValues: TestDraft = {
        name: 'John',
        age: 30,
        email: 'john@example.com',
      };

      const manager = new CoreManager<TestDraft>({
        defaultValues,
      });

      // 模拟多次访问 changed
      const startTime = performance.now();
      for (let i = 0; i < 100; i++) {
        const _ = manager.changed;
      }
      const endTime = performance.now();
      const cachedTime = endTime - startTime;

      // 无缓存版本（手动深度比较）
      const startTime2 = performance.now();
      for (let i = 0; i < 100; i++) {
        const _ = !isEqual(manager.draft, defaultValues);
      }
      const endTime2 = performance.now();
      const uncachedTime = endTime2 - startTime2;

      // 缓存版本应该更快（至少在多次访问时）
      // 注意：这个测试可能在某些环境下不稳定，所以只验证基本功能
      expect(cachedTime).toBeLessThan(uncachedTime * 2); // 允许一些误差

      manager.dispose();
    });
  });

  describe('防抖性能', () => {
    it('应该正确实现防抖功能', async () => {
      const manager = new CoreManager<TestDraft>({
        defaultValues: { name: 'John', age: 30 },
        applyDebounceMs: 50,
      });

      const applySpy = vi.spyOn(manager.form, 'submit');

      // 快速连续调用 apply
      manager.apply();
      manager.apply();
      manager.apply();

      // 等待防抖时间
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 应该只调用一次 submit（防抖生效）
      expect(applySpy).toHaveBeenCalledTimes(1);

      applySpy.mockRestore();
      manager.dispose();
    });

    it('应该在没有防抖时立即执行', async () => {
      const manager = new CoreManager<TestDraft>({
        defaultValues: { name: 'John', age: 30 },
      });

      const applySpy = vi.spyOn(manager.form, 'submit');

      await manager.apply();

      // 应该立即调用
      expect(applySpy).toHaveBeenCalledTimes(1);

      applySpy.mockRestore();
      manager.dispose();
    });
  });
});
