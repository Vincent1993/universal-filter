import type { Draft, Plugin, FilterApi } from '../core/types';
import type EventEmitter from 'eventemitter3';

/**
 * 数据转换函数类型
 * @template TSource - 源数据类型
 * @template TTarget - 目标数据类型
 */
export type TransformFn<TSource = unknown, TTarget = unknown> = (
  source: TSource,
  context?: TransformContext
) => TTarget | Promise<TTarget>;

/**
 * 转换上下文
 */
export interface TransformContext {
  /** 转换方向：'inbound' 表示外部数据到内部，'outbound' 表示内部数据到外部 */
  direction: 'inbound' | 'outbound';
  /** 当前字段路径 */
  path?: string;
  /** 其他自定义上下文数据 */
  [key: string]: unknown;
}

/**
 * 数据模型转换器配置
 */
export interface TransformerConfig<TSource = unknown, TTarget = unknown> {
  /** 转换器名称（用于调试和日志） */
  name?: string;
  /** 转换函数：从源数据转换为目标数据 */
  transform: TransformFn<TSource, TTarget>;
  /** 反向转换函数（可选）：从目标数据转换回源数据 */
  reverseTransform?: TransformFn<TTarget, TSource>;
  /** 转换条件（可选）：决定是否应用此转换器 */
  condition?: (data: unknown, context: TransformContext) => boolean;
  /** 转换方向（可选）：默认为 'both'，表示双向转换 */
  direction?: 'inbound' | 'outbound' | 'both';
}

/**
 * 数据模型转换插件选项
 */
export interface DataModelTransformPluginOptions<TDraft extends Draft = Draft> {
  /**
   * 转换器列表（按顺序执行）
   * 支持多重转换链：数据会依次通过每个转换器
   */
  transformers?: TransformerConfig[];
  /**
   * 何时应用转换
   * - 'init': 初始化时（从外部数据加载到表单）
   * - 'apply': 应用时（从表单提交到外部）
   * - 'both': 两种情况都应用（默认）
   */
  applyOn?: 'init' | 'apply' | 'both';
  /**
   * 转换失败时的处理策略
   * - 'throw': 抛出错误（默认）
   * - 'skip': 跳过转换，使用原始数据
   * - 'fallback': 使用 fallback 值
   */
  onError?: 'throw' | 'skip' | 'fallback';
  /**
   * 错误时的回退值
   */
  fallbackValue?: TDraft;
  /**
   * 是否启用调试日志
   */
  debug?: boolean;
}

/**
 * 创建数据模型转换插件
 *
 * @example
 * ```ts
 * const plugin = createDataModelTransformPlugin({
 *   transformers: [
 *     {
 *       name: 'snake_case',
 *       transform: (data) => convertKeys(data, 'snake_case'),
 *       reverseTransform: (data) => convertKeys(data, 'camelCase'),
 *     },
 *     {
 *       name: 'date-format',
 *       transform: (data) => formatDates(data, 'ISO'),
 *       reverseTransform: (data) => parseDates(data),
 *     },
 *   ],
 *   applyOn: 'both',
 * });
 * ```
 */
export function createDataModelTransformPlugin<TDraft extends Draft = Draft>(
  options: DataModelTransformPluginOptions<TDraft> = {}
): Plugin<TDraft> {
  const {
    transformers = [],
    applyOn = 'both',
    onError = 'throw',
    fallbackValue,
    debug = false,
  } = options;

  const log = (message: string, ...args: unknown[]) => {
    if (debug) {
      console.log(`[DataModelTransformPlugin] ${message}`, ...args);
    }
  };

  /**
   * 执行转换链（内部函数）
   */
  const executeTransformChainInternal = async <T = unknown>(
    data: T,
    direction: 'inbound' | 'outbound',
    path?: string
  ): Promise<T> => {
    let currentData: unknown = data;
    const context: TransformContext = { direction, path };

    for (const transformer of transformers) {
      const { name, transform, reverseTransform, condition, direction: transformerDirection } = transformer;

      // 检查转换方向
      if (transformerDirection && transformerDirection !== 'both' && transformerDirection !== direction) {
        log(`跳过转换器 ${name || 'unnamed'}（方向不匹配）`);
        continue;
      }

      // 检查转换条件
      if (condition && !condition(currentData, context)) {
        log(`跳过转换器 ${name || 'unnamed'}（条件不满足）`);
        continue;
      }

      try {
        // 选择转换函数
        const transformFn = direction === 'inbound' ? transform : reverseTransform || transform;

        if (!transformFn) {
          log(`警告：转换器 ${name || 'unnamed'} 缺少 ${direction} 方向的转换函数`);
          continue;
        }

        log(`应用转换器 ${name || 'unnamed'} (${direction})`);
        const result = await transformFn(currentData, context);

        currentData = result;
      } catch (error) {
        log(`转换器 ${name || 'unnamed'} 执行失败:`, error);

        if (onError === 'throw') {
          throw new Error(
            `数据模型转换失败 [${name || 'unnamed'}] (${direction}): ${error instanceof Error ? error.message : String(error)}`
          );
        } else if (onError === 'fallback' && fallbackValue) {
          log(`使用回退值`);
          return fallbackValue as T;
        }
        // 'skip' 策略：继续使用 currentData，不做转换
      }
    }

    return currentData as T;
  };

  // 存储事件监听器的清理函数
  let unsubscribeApplyStart: (() => void) | undefined;

  return {
    name: 'data-model-transform-plugin',
    async onInit({ root, bus, setReady }) {
      try {
        // 如果需要初始化时转换，处理初始值
        if (applyOn === 'init' || applyOn === 'both') {
          const currentValues = root.draft;
          if (currentValues && Object.keys(currentValues).length > 0) {
            log('转换初始值');
            const transformed = await executeTransformChainInternal(currentValues, 'inbound');
            root.setValues(transformed as Partial<TDraft>, 'overwrite');
            root.setInitialValues(transformed as Partial<TDraft>, 'overwrite');
          }
        }

        // 如果需要应用时转换，拦截 apply:start 事件
        // 注意：我们不能在 apply:start 中修改表单值（会导致循环）
        // 所以我们采用拦截策略：在提交前转换数据，但不修改表单
        // 实际的转换应该在业务层的提交处理函数中使用 transformOutbound 函数
        
        if (applyOn === 'apply' || applyOn === 'both') {
          // 监听 apply:start，记录日志提示用户使用转换函数
          unsubscribeApplyStart = bus.on('apply:start', async ({ draft }) => {
            try {
              log('检测到 apply:start，使用 transformOutbound 转换数据');
              // 转换数据但不修改表单（避免循环）
              const transformed = await executeTransformChainInternal(draft, 'outbound');
              log('转换后的数据:', transformed);
              // 注意：实际的转换应该在业务层的提交处理函数中完成
              // 这里只做日志记录，避免修改表单导致循环
            } catch (error) {
              log('转换提交数据失败:', error);
              if (onError === 'throw') {
                throw error;
              }
            }
          });
        }

        setReady(true);
      } catch (error) {
        log('插件初始化失败:', error);
        setReady(false, error);
      }
    },
    onDestroy() {
      // 清理事件监听器
      if (unsubscribeApplyStart) {
        unsubscribeApplyStart();
        unsubscribeApplyStart = undefined;
      }
    },
  };
}

/**
 * 导出转换函数创建器（供外部使用）
 * 这些函数可以在业务层手动调用，用于在 apply 前后转换数据
 */
export function createTransformFunctions(
  transformers: TransformerConfig[]
): TransformFunctions {
  const executeTransformChain = async (
    data: unknown,
    direction: 'inbound' | 'outbound'
  ): Promise<unknown> => {
    let currentData: unknown = data;
    const context: TransformContext = { direction };

    for (const transformer of transformers) {
      const { name, transform, reverseTransform, condition, direction: transformerDirection } = transformer;

      if (transformerDirection && transformerDirection !== 'both' && transformerDirection !== direction) {
        continue;
      }

      if (condition && !condition(currentData, context)) {
        continue;
      }

      try {
        const transformFn = direction === 'inbound' ? transform : reverseTransform || transform;
        if (!transformFn) {
          continue;
        }
        const result = await transformFn(currentData, context);
        currentData = result;
      } catch (error) {
        // 静默失败，返回原始数据
        break;
      }
    }

    return currentData;
  };

  return {
    transformInbound: (data: unknown) => executeTransformChain(data, 'inbound'),
    transformOutbound: (data: unknown) => executeTransformChain(data, 'outbound'),
  };
}

/**
 * 辅助函数：创建简单的键名转换器
 */
export function createKeyTransformTransformer(
  keyTransform: (key: string) => string,
  options?: {
    name?: string;
    direction?: 'inbound' | 'outbound' | 'both';
  }
): TransformerConfig {
  const transform = (data: unknown): unknown => {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(transform);
    }

    if (typeof data === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        const newKey = keyTransform(key);
        result[newKey] = transform(value);
      }
      return result;
    }

    return data;
  };

  return {
    name: options?.name || 'key-transform',
    transform,
    reverseTransform: transform, // 双向转换相同
    direction: options?.direction || 'both',
  };
}

/**
 * 转换函数接口
 * 这些函数可以在业务层手动调用，用于在 apply 前后转换数据
 */
export interface TransformFunctions {
  /** 入站转换：将外部数据转换为内部格式 */
  transformInbound: (data: unknown) => Promise<unknown>;
  /** 出站转换：将内部数据转换为外部格式 */
  transformOutbound: (data: unknown) => Promise<unknown>;
}

/**
 * 辅助函数：创建字段映射转换器
 */
export function createFieldMappingTransformer(
  fieldMapping: Record<string, string | string[]>,
  options?: {
    name?: string;
    direction?: 'inbound' | 'outbound' | 'both';
  }
): TransformerConfig {
  // 创建反向映射
  const reverseMapping: Record<string, string> = {};
  for (const [target, source] of Object.entries(fieldMapping)) {
    if (typeof source === 'string') {
      reverseMapping[source] = target;
    } else {
      // 多个源字段映射到同一个目标字段
      for (const src of source) {
        reverseMapping[src] = target;
      }
    }
  }

  const transform = (data: unknown, context?: TransformContext): unknown => {
    if (data === null || data === undefined || typeof data !== 'object') {
      return data;
    }

    const source = data as Record<string, unknown>;
    const mapping = context?.direction === 'outbound' ? reverseMapping : fieldMapping;
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(source)) {
      const targetKey = mapping[key];
      if (targetKey) {
        if (typeof targetKey === 'string') {
          result[targetKey] = value;
        } else {
          // 多个源字段合并到一个目标字段
          const target = targetKey[0];
          if (!result[target]) {
            result[target] = {};
          }
          (result[target] as Record<string, unknown>)[key] = value;
        }
      } else {
        // 保留未映射的字段
        result[key] = value;
      }
    }

    return result;
  };

  const reverseTransform = (data: unknown, context?: TransformContext): unknown => {
    // 反向转换逻辑类似，但使用反向映射
    return transform(data, { ...context, direction: context?.direction === 'inbound' ? 'outbound' : 'inbound' });
  };

  return {
    name: options?.name || 'field-mapping',
    transform,
    reverseTransform,
    direction: options?.direction || 'both',
  };
}
