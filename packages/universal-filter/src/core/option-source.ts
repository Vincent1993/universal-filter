import type { QueryKey, QueryObserverResult } from '@tanstack/react-query';

/**
 * Option Source - 数据源配置与请求客户端抽象
 *
 * 支持的数据源策略：
 * - static: 静态数据，直接使用 enum 配置
 * - remote-once: 首次加载时请求一次并缓存
 * - remote-on-demand: 聚焦/展开时才请求
 * - remote-search: 关键字搜索
 * - remote-depend: 依赖刷新
 */

// ==================== Types ====================

/**
 * 数据源获取策略
 */
export type OptionStrategy =
  | 'static'           // 静态数据
  | 'remote-once'      // 首次加载
  | 'remote-on-demand' // 按需加载（聚焦时）
  | 'remote-search'    // 关键字搜索
  | 'remote-depend';   // 依赖刷新

/**
 * 数据获取触发时机
 */
export type OptionTrigger =
  | 'mount'   // 组件挂载时
  | 'focus'   // 聚焦/展开时
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
  keyword?: string;
  /** 依赖字段值 */
  deps?: Record<string, unknown>;
}

/**
 * 请求客户端类型
 */
export type RequestClient = (
  config: OptionRequestConfig,
  context: OptionRequestContext
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
  /** 空数据时的占位文案 */
  emptyPlaceholder?: string;
  /** 自定义请求客户端名称（从 Provider 注册表中获取） */
  client?: string;
}

/**
 * useOptions Hook 的配置参数
 */
export interface UseOptionsConfig {
  /** 字段路径 */
  fieldPath: string;
  /** 数据源配置 */
  dataSource?: OptionSourceConfig;
  /** 静态枚举数据（优先级最高） */
  staticEnum?: OptionItem[];
  /** 依赖字段值 */
  deps?: Record<string, unknown>;
  /** 是否启用（默认 true） */
  enabled?: boolean;
}

/**
 * useOptions Hook 返回值
 */
export type UseOptionsQueryResult = Pick<
  QueryObserverResult<OptionItem[] | undefined, Error>,
  'data' | 'isLoading' | 'isFetching' | 'isError' | 'error' | 'refetch'
>;

export interface UseOptionsResult extends UseOptionsQueryResult {
  /** 选项列表（兜底为 []） */
  options: OptionItem[];
  /** 是否正在搜索（客户端防抖状态） */
  isSearching: boolean;
  /** 搜索函数（带防抖） */
  search: (keyword: string) => void;
  /** 预取数据（用于 focus 触发） */
  prefetch: () => void;
}

/**
 * FilterConfigure 级别的 Options 配置
 */
export interface OptionsRuntimeConfig {
  /** 默认请求客户端，必须由宿主应用提供 */
  requestClient: RequestClient;
  /** 命名请求客户端注册表 */
  clientRegistry?: Record<string, RequestClient>;
  /** 全局数据转换函数 */
  globalTransform?: OptionTransform;
  /** 全局缓存配置 */
  cacheConfig?: {
    staleTime?: number;
    gcTime?: number;
  };
}

// ==================== Transform Helpers ====================

/**
 * 默认的数据转换函数 - 尝试从常见响应格式中提取 options
 */
export const defaultTransform: OptionTransform = (response: unknown): OptionItem[] => {
  if (!response) return [];

  // 直接是数组
  if (Array.isArray(response)) {
    return normalizeOptions(response);
  }

  // 常见的响应格式
  const resp = response as Record<string, unknown>;

  // { data: [...] }
  if (Array.isArray(resp.data)) {
    return normalizeOptions(resp.data);
  }

  // { list: [...] }
  if (Array.isArray(resp.list)) {
    return normalizeOptions(resp.list);
  }

  // { items: [...] }
  if (Array.isArray(resp.items)) {
    return normalizeOptions(resp.items);
  }

  // { options: [...] }
  if (Array.isArray(resp.options)) {
    return normalizeOptions(resp.options);
  }

  // { result: { data: [...] } }
  if (resp.result && typeof resp.result === 'object') {
    const result = resp.result as Record<string, unknown>;
    if (Array.isArray(result.data)) {
      return normalizeOptions(result.data);
    }
    if (Array.isArray(result.list)) {
      return normalizeOptions(result.list);
    }
  }

  return [];
};

/**
 * 标准化选项数组
 */
function normalizeOptions(items: unknown[]): OptionItem[] {
  return items.map((item) => {
    if (typeof item === 'string' || typeof item === 'number') {
      return { label: String(item), value: item };
    }

    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;

      // 已经是标准格式
      if ('label' in obj && 'value' in obj) {
        return {
          label: String(obj.label),
          value: obj.value as string | number,
          disabled: obj.disabled as boolean | undefined,
          children: obj.children ? normalizeOptions(obj.children as unknown[]) : undefined,
          ...obj,
        };
      }

      // 常见的 name/id 格式
      if ('name' in obj && 'id' in obj) {
        return {
          label: String(obj.name),
          value: obj.id as string | number,
          disabled: obj.disabled as boolean | undefined,
          ...obj,
        };
      }

      // title/value 格式
      if ('title' in obj && 'value' in obj) {
        return {
          label: String(obj.title),
          value: obj.value as string | number,
          disabled: obj.disabled as boolean | undefined,
          ...obj,
        };
      }

      // text/value 格式
      if ('text' in obj && 'value' in obj) {
        return {
          label: String(obj.text),
          value: obj.value as string | number,
          disabled: obj.disabled as boolean | undefined,
          ...obj,
        };
      }
    }

    // fallback
    return { label: String(item), value: String(item) };
  });
}

// ==================== Query Key Builder ====================

/**
 * 构建 React Query 的 queryKey
 */
export function buildOptionsQueryKey(
  fieldPath: string,
  config: OptionSourceConfig,
  deps?: Record<string, unknown>,
  keyword?: string
): OptionQueryKey {
  if (config.queryKey) {
    return Array.isArray(config.queryKey) ? config.queryKey : [config.queryKey];
  }

  const key: unknown[] = ['options', fieldPath];

  if (config.request?.url) {
    key.push(config.request.url);
  }

  if (deps && Object.keys(deps).length > 0) {
    key.push(deps);
  }

  if (keyword) {
    key.push({ keyword });
  }

  return key as OptionQueryKey;
}

/**
 * 判断是否应该自动获取数据
 */
export function shouldAutoFetch(
  config: OptionSourceConfig,
  trigger?: OptionTrigger
): boolean {
  const effectiveTrigger = trigger ?? config.trigger ?? 'mount';

  if (config.strategy === 'static') {
    return false;
  }

  if (config.strategy === 'remote-on-demand') {
    return effectiveTrigger !== 'mount';
  }

  return effectiveTrigger === 'mount';
}

