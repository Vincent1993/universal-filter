import type { FilterApi, FilterEventMap, Draft } from './types';

/**
 * 订阅配置选项
 */
export interface SubscribeOptions<TDraft extends Draft = Draft> {
  /** 是否立即执行一次（对于某些事件） */
  immediate?: boolean;
  /** 自定义错误处理 */
  onError?: (error: Error) => void;
}

/**
 * 订阅工具类
 * 提供便捷的事件订阅方法，支持链式调用和自动清理
 */
export class FilterSubscriber<TDraft extends Draft = Draft> {
  private unsubscribers: Array<() => void> = [];
  private disposed = false;

  constructor(private filter: FilterApi<TDraft>) {}

  /**
   * 订阅 draft 变化事件
   * @param callback - 回调函数
   * @param options - 订阅选项
   */
  onDraftChange(
    callback: (draft: TDraft, prev?: TDraft) => void,
    options?: SubscribeOptions<TDraft>
  ): this {
    if (this.disposed) {
      throw new Error('FilterSubscriber has been disposed');
    }

    const unsubscribe = this.filter.on('draft:change', ({ draft, prev }) => {
      try {
        callback(draft, prev);
      } catch (error) {
        options?.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    });

    this.unsubscribers.push(unsubscribe);

    // 如果设置了 immediate，立即执行一次
    if (options?.immediate) {
      try {
        callback(this.filter.draft);
      } catch (error) {
        options?.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    }

    return this;
  }

  /**
   * 订阅 apply 开始事件
   */
  onApplyStart(callback: (draft: TDraft) => void, options?: SubscribeOptions<TDraft>): this {
    if (this.disposed) {
      throw new Error('FilterSubscriber has been disposed');
    }

    const unsubscribe = this.filter.on('apply:start', ({ draft }) => {
      try {
        callback(draft);
      } catch (error) {
        options?.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    });

    this.unsubscribers.push(unsubscribe);
    return this;
  }

  /**
   * 订阅 apply 成功事件
   */
  onApplySuccess(
    callback: (draft: TDraft, payload: unknown) => void,
    options?: SubscribeOptions<TDraft>
  ): this {
    if (this.disposed) {
      throw new Error('FilterSubscriber has been disposed');
    }

    const unsubscribe = this.filter.on('apply:success', ({ draft, payload }) => {
      try {
        callback(draft, payload);
      } catch (error) {
        options?.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    });

    this.unsubscribers.push(unsubscribe);
    return this;
  }

  /**
   * 订阅验证失败事件
   */
  onValidateFailed(
    callback: (draft: TDraft, errors: any[]) => void,
    options?: SubscribeOptions<TDraft>
  ): this {
    if (this.disposed) {
      throw new Error('FilterSubscriber has been disposed');
    }

    const unsubscribe = this.filter.on('validate:failed', ({ draft, errors }) => {
      try {
        callback(draft, errors);
      } catch (error) {
        options?.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    });

    this.unsubscribers.push(unsubscribe);
    return this;
  }

  /**
   * 订阅重置事件
   */
  onReset(
    callback: (scope: 'all' | 'group' | string, target?: string) => void,
    options?: SubscribeOptions<TDraft>
  ): this {
    if (this.disposed) {
      throw new Error('FilterSubscriber has been disposed');
    }

    const unsubscribe = this.filter.on('reset', ({ scope, target }) => {
      try {
        callback(scope, target);
      } catch (error) {
        options?.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    });

    this.unsubscribers.push(unsubscribe);
    return this;
  }

  /**
   * 订阅插件就绪事件
   */
  onPluginReady(
    callback: (name: string, ready: boolean, error?: unknown) => void,
    options?: SubscribeOptions<TDraft>
  ): this {
    if (this.disposed) {
      throw new Error('FilterSubscriber has been disposed');
    }

    const unsubscribe = this.filter.on('plugin:ready', ({ name, ready, error }) => {
      try {
        callback(name, ready, error);
      } catch (error) {
        options?.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    });

    this.unsubscribers.push(unsubscribe);
    return this;
  }

  /**
   * 订阅所有插件就绪事件
   */
  onPluginsReady(
    callback: (ready: boolean) => void,
    options?: SubscribeOptions<TDraft>
  ): this {
    if (this.disposed) {
      throw new Error('FilterSubscriber has been disposed');
    }

    const unsubscribe = this.filter.on('plugins:ready', ({ ready }) => {
      try {
        callback(ready);
      } catch (error) {
        options?.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    });

    this.unsubscribers.push(unsubscribe);
    return this;
  }

  /**
   * 订阅销毁事件
   */
  onDestroy(callback: () => void, options?: SubscribeOptions<TDraft>): this {
    if (this.disposed) {
      throw new Error('FilterSubscriber has been disposed');
    }

    const unsubscribe = this.filter.on('destroy', () => {
      try {
        callback();
      } catch (error) {
        options?.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    });

    this.unsubscribers.push(unsubscribe);
    return this;
  }

  /**
   * 订阅任意事件（通用方法）
   */
  on<K extends keyof FilterEventMap<TDraft>>(
    event: K,
    callback: (payload: FilterEventMap<TDraft>[K]) => void,
    options?: SubscribeOptions<TDraft>
  ): this {
    if (this.disposed) {
      throw new Error('FilterSubscriber has been disposed');
    }

    const unsubscribe = this.filter.on(event, (payload) => {
      try {
        callback(payload);
      } catch (error) {
        options?.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    });

    this.unsubscribers.push(unsubscribe);
    return this;
  }

  /**
   * 一次性订阅（只触发一次）
   */
  once<K extends keyof FilterEventMap<TDraft>>(
    event: K,
    callback: (payload: FilterEventMap<TDraft>[K]) => void,
    options?: SubscribeOptions<TDraft>
  ): this {
    if (this.disposed) {
      throw new Error('FilterSubscriber has been disposed');
    }

    const unsubscribe = this.filter.once(event, (payload) => {
      try {
        callback(payload);
      } catch (error) {
        options?.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    });

    this.unsubscribers.push(unsubscribe);
    return this;
  }

  /**
   * 清理所有订阅
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers = [];
  }
}

/**
 * 创建订阅工具实例
 * 
 * @example
 * ```ts
 * const subscriber = createSubscriber(filter);
 * 
 * subscriber
 *   .onDraftChange((draft, prev) => {
 *     console.log('Draft changed:', draft);
 *   })
 *   .onApplySuccess((draft, payload) => {
 *     console.log('Applied:', draft);
 *   });
 * 
 * // 清理订阅
 * subscriber.dispose();
 * ```
 */
export function createSubscriber<TDraft extends Draft = Draft>(
  filter: FilterApi<TDraft>
): FilterSubscriber<TDraft> {
  return new FilterSubscriber(filter);
}
