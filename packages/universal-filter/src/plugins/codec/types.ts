import type { Draft } from '../../core/types';

/**
 * 转换状态类型（响应式）
 */
export interface TransformState {
  /** 是否正在转换 */
  isTransforming: boolean;
  /** 当前正在执行的转换器名称（如果有） */
  currentTransformer?: string;
  /** 转换方向 */
  direction?: 'inbound' | 'outbound';
  /** 转换进度（0-1，可选） */
  progress?: number;
}

/**
 * codec 转换函数类型
 * @template TSource - 源数据类型
 * @template TTarget - 目标数据类型
 * @template TOriginal - 原始数据类型
 */
export type TransformFn<
  TSource = unknown,
  TTarget = unknown,
  TOriginal = unknown
> = (
  source: TSource,
  context?: TransformContext<TOriginal>
) => TTarget | Promise<TTarget>;

/**
 * 转换上下文
 */
export interface TransformContext<TOriginal = unknown> {
  /** 转换方向：'inbound' 表示外部数据到内部，'outbound' 表示内部数据到外部 */
  direction: 'inbound' | 'outbound';
  /** 当前字段路径 */
  path?: string;
  /** 原始数据（转换前的数据副本） */
  originalValue?: TOriginal;
  /** 其他自定义上下文数据 */
  [key: string]: unknown;
}

/**
 * codec 转换器配置
 */
export interface TransformerConfig<
  TSource = unknown,
  TTarget = unknown,
  TOriginal extends Record<string, any> = Record<string, any>
> {
  /** 转换器名称（用于调试和日志） */
  name?: string;
  /** 转换函数：从源数据转换为目标数据 (Inbound) */
  transform?: TransformFn<TSource, TTarget, TOriginal>;
  /** 反向转换函数（可选）：从目标数据转换回源数据 (Outbound) */
  reverseTransform?: TransformFn<TTarget, TSource, TOriginal>;
  /** 转换条件（可选）：决定是否应用此转换器，支持异步 */
  condition?: (
    data: TSource,
    context: TransformContext<TOriginal>
  ) => boolean | Promise<boolean>;
  /** 转换方向（可选）：默认为 'both'，表示双向转换 */
  direction?: 'inbound' | 'outbound' | 'both';
}

/**
 * codec 转换插件选项
 */
export interface CodecTransformPluginOptions<TDraft extends Draft = Draft> {
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
  /**
   * 是否启用转换状态追踪（用于 UI 加载提示）
   * 启用后会在插件状态中维护转换状态，可通过 filter.plugin.get('codec-plugin')?.transformState 访问
   * @default true
   */
  enableTransformState?: boolean;
}

/**
 * codec 转换函数接口
 * 这些函数可以在业务层手动调用，用于在 apply 前后转换数据
 */
export interface TransformFunctions {
  /** 入站转换：将外部数据转换为内部格式 */
  transformInbound: <T = unknown>(data: T) => Promise<T>;
  /** 出站转换：将内部数据转换为外部格式 */
  transformOutbound: <T = unknown>(data: T) => Promise<T>;
}

/**
 * CodecRuntime 配置选项
 */
export interface CodecRuntimeOptions {
  /**
   * 转换器列表（按顺序执行）
   */
  transformers?: TransformerConfig[];
  /**
   * 转换失败时的处理策略
   * @default 'throw'
   */
  onError?: 'throw' | 'skip' | 'fallback';
  /**
   * 错误时的回退值
   */
  fallbackValue?: unknown;
  /**
   * 是否启用调试日志
   * @default false
   */
  debug?: boolean;
  /**
   * 是否启用转换状态追踪
   * @default true
   */
  enableTransformState?: boolean;
  /**
   * 插件名称（用于状态存储）
   * @default 'codec-plugin'
   */
  pluginName?: string;
}

/**
 * Codec 插件公开 API
 * 通过 filter.plugin.get('codec-plugin')?.state 访问
 */
export interface CodecPluginApi {
  /** 转换状态 */
  transformState: TransformState;
  /** 入站转换函数 */
  transformInbound: <T = unknown>(data: T) => Promise<T>;
  /** 出站转换函数 */
  transformOutbound: <T = unknown>(data: T) => Promise<T>;
}
