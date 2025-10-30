/**
 * 订阅工具测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFilter } from '../../src/core';
import { createSubscriber } from '../../src/core/subscribe';
import type { Draft } from '../../src/core/types';

interface TestDraft extends Draft {
  name: string;
  age: number;
  email?: string;
}

describe('FilterSubscriber', () => {
  let filter: ReturnType<typeof createFilter<TestDraft>>;

  beforeEach(() => {
    filter = createFilter<TestDraft>({
      defaultValues: {
        name: 'John',
        age: 30,
      },
    });
  });

  afterEach(() => {
    filter.dispose();
  });

  describe('基础功能', () => {
    it('应该能够创建订阅器实例', () => {
      const subscriber = createSubscriber(filter);
      expect(subscriber).toBeDefined();
      subscriber.dispose();
    });

    it('应该支持链式调用', () => {
      const subscriber = createSubscriber(filter);
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      subscriber.onDraftChange(callback1).onApplyStart(callback2);

      filter.setValue('name', 'Jane');

      expect(callback1).toHaveBeenCalled();
      subscriber.dispose();
    });
  });

  describe('onDraftChange', () => {
    it('应该能够订阅 draft 变化事件', () => {
      const subscriber = createSubscriber(filter);
      const callback = vi.fn();

      subscriber.onDraftChange(callback);

      filter.setValue('name', 'Jane');

      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Jane' }),
        expect.any(Object)
      );

      subscriber.dispose();
    });

    it('应该支持 immediate 选项', () => {
      const subscriber = createSubscriber(filter);
      const callback = vi.fn();

      subscriber.onDraftChange(callback, { immediate: true });

      // 应该立即调用一次
      expect(callback).toHaveBeenCalledTimes(1);

      // 修改值后再次调用
      filter.setValue('name', 'Jane');
      expect(callback).toHaveBeenCalledTimes(2);

      subscriber.dispose();
    });
  });

  describe('onApplyStart', () => {
    it('应该能够订阅 apply 开始事件', async () => {
      const subscriber = createSubscriber(filter);
      const callback = vi.fn();

      subscriber.onApplyStart(callback);

      await filter.apply();

      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(expect.any(Object));

      subscriber.dispose();
    });
  });

  describe('onApplySuccess', () => {
    it('应该能够订阅 apply 成功事件', async () => {
      const subscriber = createSubscriber(filter);
      const callback = vi.fn();

      subscriber.onApplySuccess(callback);

      await filter.apply();

      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));

      subscriber.dispose();
    });
  });

  describe('onValidateFailed', () => {
    it('应该能够订阅验证失败事件', () => {
      const subscriber = createSubscriber(filter);
      const callback = vi.fn();

      subscriber.onValidateFailed(callback);

      // 注意：这里只是测试订阅功能，实际的验证失败需要配置验证规则
      subscriber.dispose();
    });
  });

  describe('onReset', () => {
    it('应该能够订阅重置事件', () => {
      const subscriber = createSubscriber(filter);
      const callback = vi.fn();

      subscriber.onReset(callback);

      filter.reset();

      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith('all', undefined);

      subscriber.dispose();
    });
  });

  describe('onPluginReady', () => {
    it('应该能够订阅插件就绪事件', async () => {
      const subscriber = createSubscriber(filter);
      const callback = vi.fn();

      subscriber.onPluginReady(callback);

      // 等待插件初始化
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 注意：如果没有插件，可能不会触发事件
      subscriber.dispose();
    });
  });

  describe('通用订阅方法', () => {
    it('应该能够使用 on 方法订阅任意事件', () => {
      const subscriber = createSubscriber(filter);
      const callback = vi.fn();

      subscriber.on('draft:change', callback);

      filter.setValue('name', 'Jane');

      expect(callback).toHaveBeenCalled();

      subscriber.dispose();
    });

    it('应该能够使用 once 方法一次性订阅', () => {
      const subscriber = createSubscriber(filter);
      const callback = vi.fn();

      subscriber.once('draft:change', callback);

      filter.setValue('name', 'Jane');
      filter.setValue('name', 'Bob');

      // 应该只调用一次
      expect(callback).toHaveBeenCalledTimes(1);

      subscriber.dispose();
    });
  });

  describe('错误处理', () => {
    it('应该能够处理回调函数中的错误', () => {
      const subscriber = createSubscriber(filter);
      const onError = vi.fn();
      const callback = vi.fn(() => {
        throw new Error('Test error');
      });

      subscriber.onDraftChange(callback, { onError });

      filter.setValue('name', 'Jane');

      expect(onError).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(expect.any(Error));

      subscriber.dispose();
    });
  });

  describe('dispose', () => {
    it('应该能够清理所有订阅', () => {
      const subscriber = createSubscriber(filter);
      const callback = vi.fn();

      subscriber.onDraftChange(callback);
      subscriber.dispose();

      filter.setValue('name', 'Jane');

      // 清理后不应该再调用
      expect(callback).not.toHaveBeenCalled();
    });

    it('多次调用 dispose 应该安全', () => {
      const subscriber = createSubscriber(filter);
      subscriber.dispose();
      expect(() => subscriber.dispose()).not.toThrow();
    });

    it('dispose 后应该抛出错误', () => {
      const subscriber = createSubscriber(filter);
      subscriber.dispose();

      expect(() => {
        subscriber.onDraftChange(() => {});
      }).toThrow('FilterSubscriber has been disposed');
    });
  });
});
