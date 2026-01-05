
import type { QueryKey, QueryObserverResult } from '@tanstack/react-query';

// ==================== Types ====================

/**
 * 数据源获取策略
 */
export type OptionStrategy =
  | 'static' // 静态数据
  | 'remote-once' // 首次加载
  | 'remote-search'; // 关键字搜索

/**
 * 数据获取触发时机
 */
export type OptionTrigger =
  | 'mount' // 组件挂载时
  | 'focus' // 聚焦/展开时
  | 'manual'; // 手动触发

/**
 * 请求配置
 */
export interface OptionRequestConfig {
  /** 请求 URL */
  url: string;
  /** 请求方法，默认 GET */
  method?: 'GET' | 'POST';
  /** 静态参数 */
  params?: Record<string, unknown>;
  /** 请求体（POST 时使用） */
  body?: Record<string, unknown>;
  /** 请求头 */
  headers?: Record<string, string>;
}

/**
 * 选项项类型
 */
export interface OptionItem {
  label: string;
  value: string | number;
  disabled?: boolean;
  children?: OptionItem[];
  [key: string]: unknown;
}

/**
 * 请求上下文 - 传递给 RequestClient 的额外信息
 */
export interface OptionRequestContext {
  /** 字段路径 */
  fieldPath?: string;
  /** 搜索关键字 */
  searchTerm?: string;
  /** 依赖字段值 */
  deps?: Record<string, unknown>;
}

/**
 * 请求客户端类型
 */
export type RequestClient = (
  config: OptionRequestConfig,
  context: OptionRequestContext,
) => Promise<unknown>;

/**
 * 数据转换函数类型
 */
export type OptionTransform = (response: unknown) => OptionItem[];

/**
 * 数据源配置
 */
export type OptionQueryKey = QueryKey;

export interface OptionSourceConfig {
  /** 数据源策略 */
  strategy: OptionStrategy;
  /** 触发时机，默认 mount */
  trigger?: OptionTrigger;
  /** 自定义 queryKey（默认包含字段路径、请求 URL、依赖等信息） */
  queryKey?: OptionQueryKey;
  /** 请求配置（remote-* 策略时必填） */
  request?: OptionRequestConfig;
  /** 依赖字段路径（remote-depend 策略时使用） */
  dependencies?: string[];
  /** 搜索防抖时间（ms），默认 300 */
  searchDebounce?: number;
  /** 数据新鲜时间（ms），默认 5 分钟 */
  staleTime?: number;
  /** 缓存保留时间（ms），默认 30 分钟 */
  gcTime?: number;
  /** 数据转换函数或表达式 */
  transform?: OptionTransform | string;
  /** 唯一键, 用来合并预取数据和搜索数据进行使用的，默认值为 value */
  uniqKey?: string;
}

/**
 * useOptions Hook 的配置参数
 */
export interface UseOptionsConfig {
  /** 字段路径 */
  fieldPath?: string;
  /** 数据源配置 */
  dataSource?: OptionSourceConfig;
  /** 静态枚举数据（优先级最高） */
  staticEnum?: OptionItem[];
  /** 依赖字段值 */
  deps?: Record<string, unknown>;
}

/**
 * useOptions Hook 返回值
 */
export type UseOptionsResult = QueryObserverResult<OptionItem[], Error> & {
  /** 搜索函数（带防抖） */
  search: (keyword: string) => void;
};

/**
 * FilterConfigure 级别的 Options 配置
 */
export interface OptionsRuntimeConfig {
  /** 默认请求客户端，必须由宿主应用提供 */
  requestClient: RequestClient;
  /** 全局缓存配置 */
  cacheConfig?: {
    staleTime?: number;
    gcTime?: number;
  };
}

export type CompiledRequestConfig = OptionRequestConfig & Record<string, any>;