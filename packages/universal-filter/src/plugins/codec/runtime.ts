import type { Draft } from '../../core/types';
import type { PluginManager } from '../../core/managers/PluginManager';
import type {
  TransformerConfig,
  TransformContext,
  TransformState,
  CodecRuntimeOptions,
  TransformFunctions,
} from './types';

/**
 * CodecRuntime - 编解码运行时
 *
 * 负责执行转换链、管理转换状态、处理错误等
 * 可被插件和业务代码共享使用
 */
export class CodecRuntime<TDraft extends Draft = Draft> {
  private readonly transformers: TransformerConfig[];
  private readonly onError: 'throw' | 'skip' | 'fallback';
  private readonly fallbackValue?: unknown;
  private readonly debug: boolean;
  private readonly enableTransformState: boolean;
  private readonly pluginName: string;

  private pluginManager?: PluginManager<TDraft>;

  constructor(options: CodecRuntimeOptions = {}) {
    this.transformers = options.transformers ?? [];
    this.onError = options.onError ?? 'throw';
    this.fallbackValue = options.fallbackValue;
    this.debug = options.debug ?? false;
    this.enableTransformState = options.enableTransformState ?? true;
    this.pluginName = options.pluginName ?? 'codec-plugin';
  }

  /**
   * 绑定 PluginManager（用于状态更新）
   */
  bindPluginManager(pluginManager: PluginManager<TDraft>): void {
    this.pluginManager = pluginManager;
  }

  /**
   * 日志输出
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[CodecRuntime] ${message}`, ...args);
    }
  }

  /**
   * 更新转换状态（响应式）
   */
  private updateTransformState(updates: Partial<TransformState>): void {
    if (!this.enableTransformState || !this.pluginManager) {
      return;
    }

    this.pluginManager.setState<{ transformState: TransformState }>(
      this.pluginName,
      (prev) => ({
        transformState: {
          isTransforming: false,
          ...prev?.transformState,
          ...updates,
        },
      })
    );
  }

  /**
   * 初始化转换状态
   */
  initializeState(): void {
    if (!this.enableTransformState || !this.pluginManager) {
      return;
    }

    this.pluginManager.setState<{ transformState: TransformState }>(
      this.pluginName,
      {
        transformState: {
          isTransforming: false,
        },
      }
    );
  }

  /**
   * 获取当前转换状态
   */
  getState(): TransformState | undefined {
    if (!this.pluginManager) {
      return undefined;
    }

    const state = this.pluginManager.getState<{ transformState: TransformState }>(
      this.pluginName
    );
    return state?.transformState;
  }

  /**
   * 执行单个转换器
   */
  private async executeTransformer(
    transformer: TransformerConfig,
    data: unknown,
    context: TransformContext<any>
  ): Promise<{ result: unknown; skipped: boolean }> {
    const {
      name,
      transform,
      reverseTransform,
      condition,
      direction: transformerDirection,
    } = transformer;
    const { direction } = context;

    // 1. 检查转换方向
    if (
      transformerDirection &&
      transformerDirection !== 'both' &&
      transformerDirection !== direction
    ) {
      this.log(`跳过转换器 ${name ?? 'unnamed'}（方向不匹配）`);
      return { result: data, skipped: true };
    }

    // 2. 选择转换函数：inbound 使用 transform，outbound 使用 reverseTransform
    const transformFn =
      direction === 'inbound' ? transform : reverseTransform;

    if (!transformFn) {
      // 这是一个正常的跳过行为
      this.log(
        `跳过转换器 ${name ?? 'unnamed'}（未配置 ${direction} 转换函数）`
      );
      return { result: data, skipped: true };
    }

    // 3. 检查转换条件
    if (condition) {
      try {
        const conditionResult = await condition(data, context);
        if (!conditionResult) {
          this.log(`跳过转换器 ${name ?? 'unnamed'}（条件不满足）`);
          return { result: data, skipped: true };
        }
      } catch (error) {
        this.log(`转换器 ${name ?? 'unnamed'} 条件检查失败:`, error);
        return this.handleError(error, data, direction, name);
      }
    }

    // 4. 执行转换
    try {
      this.log(`应用转换器 ${name ?? 'unnamed'} (${direction})`);
      const result = await transformFn(data, context);
      return { result, skipped: false };
    } catch (error) {
      this.log(`转换器 ${name ?? 'unnamed'} 执行失败:`, error);
      return this.handleError(error, data, direction, name);
    }
  }

  /**
   * 统一错误处理
   */
  private handleError(
    error: unknown,
    currentData: unknown,
    direction: string,
    name?: string
  ): { result: unknown; skipped: boolean } {
    if (this.onError === 'throw') {
      throw new Error(
        `codec 转换失败 [${name ?? 'unnamed'}] (${direction}): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } else if (this.onError === 'fallback' && this.fallbackValue !== undefined) {
      this.log(`使用回退值`);
      return { result: this.fallbackValue, skipped: false };
    }
    // 'skip' 策略：继续使用原始数据
    return { result: currentData, skipped: false };
  }

  /**
   * 执行转换链
   */
  private async executeTransformChain<T = unknown>(
    data: T,
    direction: 'inbound' | 'outbound',
    path?: string
  ): Promise<T> {
    let currentData: unknown = data;

    // 保存一份原始数据的拷贝
    let originalValue: unknown;
    try {
      originalValue = structuredClone(data);
    } catch (e) {
      this.log('structuredClone failed, falling back to original reference', e);
      originalValue = data;
    }

    const context: TransformContext<any> = { direction, path, originalValue };
    const totalTransformers = this.transformers.length;

    // 更新转换开始状态
    this.updateTransformState({
      isTransforming: true,
      direction,
      currentTransformer: undefined,
      progress: 0,
    });

    try {
      for (let i = 0; i < this.transformers.length; i++) {
        const transformer = this.transformers[i];

        // 更新当前转换器状态
        if (transformer.name) {
          this.updateTransformState({
            currentTransformer: transformer.name,
            progress: i / totalTransformers,
          });
        }

        const { result, skipped } = await this.executeTransformer(
          transformer,
          currentData,
          context
        );

        if (!skipped) {
          currentData = result;
        }

        // 如果使用了 fallback，提前返回
        if (
          this.onError === 'fallback' &&
          this.fallbackValue !== undefined &&
          result === this.fallbackValue
        ) {
          this.updateTransformState({
            isTransforming: false,
            currentTransformer: undefined,
            progress: 1,
          });
          return result as T;
        }
      }

      return currentData as T;
    } finally {
      // 更新转换完成状态
      this.updateTransformState({
        isTransforming: false,
        currentTransformer: undefined,
        progress: 1,
      });
    }
  }

  /**
   * 入站转换：将外部数据转换为内部格式
   * @param data - 外部数据
   * @param path - 可选的字段路径
   * @returns 转换后的内部数据
   */
  async runInbound<T = unknown>(data: T, path?: string): Promise<T> {
    this.log('执行入站转换', { data, path });
    return this.executeTransformChain(data, 'inbound', path);
  }

  /**
   * 出站转换：将内部数据转换为外部格式
   * @param data - 内部数据
   * @param path - 可选的字段路径
   * @returns 转换后的外部数据
   */
  async runOutbound<T = unknown>(data: T, path?: string): Promise<T> {
    this.log('执行出站转换', { data, path });
    return this.executeTransformChain(data, 'outbound', path);
  }

  /**
   * 检查是否有转换器配置
   */
  hasTransformers(): boolean {
    return this.transformers.length > 0;
  }
}

/**
 * 创建 CodecRuntime 实例
 */
export function createCodecRuntime<TDraft extends Draft = Draft>(
  options: CodecRuntimeOptions = {}
): CodecRuntime<TDraft> {
  return new CodecRuntime<TDraft>(options);
}

/**
 * 创建独立的转换函数（供外部使用）
 *
 * 这些函数可以在业务层手动调用，用于在 apply 前后转换数据，
 * 不依赖于 Filter 实例和插件系统。
 *
 * @example
 * ```ts
 * const transformFunctions = createTransformFunctions([
 *   {
 *     name: 'snake-to-camel',
 *     transform: (data) => convertKeys(data, 'camelCase'),
 *     reverseTransform: (data) => convertKeys(data, 'snake_case'),
 *   },
 * ]);
 *
 * // 入站转换（外部数据 -> 内部格式）
 * const internalData = await transformFunctions.transformInbound(apiResponse);
 *
 * // 出站转换（内部格式 -> 外部数据）
 * const apiPayload = await transformFunctions.transformOutbound(formData);
 * ```
 */
export function createTransformFunctions(
  transformers: TransformerConfig[],
  options?: {
    onError?: 'throw' | 'skip' | 'fallback';
    fallbackValue?: unknown;
    debug?: boolean;
  }
): TransformFunctions {
  const runtime = new CodecRuntime({
    transformers,
    onError: options?.onError ?? 'skip',
    fallbackValue: options?.fallbackValue,
    debug: options?.debug ?? false,
    enableTransformState: false, // 独立使用时不需要状态追踪
  });

  return {
    transformInbound: <T = unknown>(data: T) => runtime.runInbound(data),
    transformOutbound: <T = unknown>(data: T) => runtime.runOutbound(data),
  };
}

