/**
 * 异步串行瀑布流钩子
 *
 * 类似于 tapable 的 AsyncSeriesWaterfallHook
 * 上一个监听器的返回值会作为下一个监听器的第一个参数
 */
export class AsyncSeriesWaterfallHook<T, TContext = unknown> {
  private taps: Array<{
    name: string;
    fn: (data: T, context: TContext) => Promise<T>;
  }> = [];

  constructor(private args: string[] = []) {}

  /**
   * 注册监听器（同步）
   * @param name - 监听器名称
   * @param fn - 处理函数，接收数据和上下文，返回处理后的数据
   * @returns 取消注册的函数
   */
  tap(
    name: string,
    fn: (data: T, context: TContext) => T
  ): () => void {
    return this.tapPromise(name, async (data, context) => fn(data, context));
  }

  /**
   * 注册监听器（支持异步）
   * @param name - 监听器名称
   * @param fn - 处理函数，接收数据和上下文，返回处理后的数据
   * @returns 取消注册的函数
   */
  tapPromise(
    name: string,
    fn: (data: T, context: TContext) => Promise<T>
  ): () => void {
    this.taps.push({ name, fn });
    return () => {
      this.taps = this.taps.filter((t) => t.name !== name);
    };
  }

  /**
   * 触发钩子执行
   * @param initialValue - 初始值
   * @param context - 上下文数据（透传给所有监听器，不会被修改）
   * @returns 最终处理后的值
   */
  async call(initialValue: T, context: TContext): Promise<T> {
    let result = initialValue;
    for (const { fn } of this.taps) {
      result = await fn(result, context);
    }
    return result;
  }

  /**
   * 检查是否有注册的监听器
   */
  get isUsed(): boolean {
    return this.taps.length > 0;
  }
}

