/**
 * useOptions Hook - 统一的数据源获取 Hook
 *
 * 支持：
 * - 静态数据
 * - 远程数据（首次加载、按需加载、搜索、依赖刷新）
 * - 自定义请求客户端
 * - 与 Formily field.setDataSource 集成
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useField as useFormilyField } from '@formily/react';
import type { GeneralField } from '@formily/core';

import {
  type OptionSourceConfig,
  type OptionItem,
  type RequestClient,
  type OptionTransform,
  type UseOptionsResult,
  defaultTransform,
  buildOptionsQueryKey,
  shouldAutoFetch,
} from '../core/option-source';
import { useOptionsContext } from '../context/OptionsContext';

// ==================== Types ====================

export interface UseOptionsParams {
  /** 字段路径（用于缓存 key） */
  fieldPath: string;
  /** 数据源配置（来自 Schema 的 x-data-source） */
  dataSource?: OptionSourceConfig;
  /** 静态枚举数据（优先级最高） */
  staticEnum?: OptionItem[];
  /** 依赖字段值 */
  deps?: Record<string, unknown>;
  /** 是否启用（默认 true） */
  enabled?: boolean;
  /** 是否自动同步到 Formily field.dataSource（默认 true） */
  syncToField?: boolean;
}

// ==================== Hook Implementation ====================

/**
 * useOptions - 统一的数据源获取 Hook
 *
 * @example
 * ```tsx
 * // 在自定义组件中使用
 * function MySelect() {
 *   const field = useField();
 *   const schema = useFieldSchema();
 *
 *   const { options, isLoading, search } = useOptions({
 *     fieldPath: field.path.toString(),
 *     dataSource: schema['x-data-source'],
 *     deps: { channelType: form.values.channelType },
 *   });
 *
 *   return (
 *     <Select
 *       options={options}
 *       loading={isLoading}
 *       onSearch={search}
 *     />
 *   );
 * }
 * ```
 */
export function useOptions(params: UseOptionsParams): UseOptionsResult {
  const {
    fieldPath,
    dataSource,
    staticEnum,
    deps,
    enabled = true,
    syncToField = true,
  } = params;

  // 获取 Provider 级别配置
  const optionsContext = useOptionsContext();

  // 尝试获取 Formily field（可能不在 Formily 上下文中）
  let formilyField: GeneralField | null = null;
  try {
    formilyField = useFormilyField();
  } catch {
    // 不在 Formily 上下文中，忽略
  }

  // 搜索关键字状态
  const [keyword, setKeyword] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // 防抖定时器
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Query Client
  const queryClient = useQueryClient();

  // 解析请求客户端
  const requestClient = useMemo<RequestClient | null>(() => {
    if (!optionsContext) return null;
    if (dataSource?.client && optionsContext.clientRegistry?.[dataSource.client]) {
      return optionsContext.clientRegistry[dataSource.client];
    }
    return optionsContext.requestClient;
  }, [dataSource, optionsContext]);

  if (
    dataSource &&
    dataSource.strategy !== 'static' &&
    !requestClient
  ) {
    throw new Error(
      '[Universal Filter] useOptions requires a requestClient. Please wrap your application with <FilterConfigure value={{ options: { requestClient } }}> and provide a request client.'
    );
  }

  // 解析数据转换函数
  const transformFn = useMemo<OptionTransform>(() => {
    if (!dataSource?.transform) {
      return optionsContext?.globalTransform ?? defaultTransform;
    }

    if (typeof dataSource.transform === 'function') {
      return dataSource.transform;
    }

    // 字符串表达式暂不支持，使用默认
    return defaultTransform;
  }, [dataSource, optionsContext]);

  // 构建 Query Key
  const queryKey = useMemo(() => {
    if (!dataSource) return ['options', fieldPath, 'static'];
    return buildOptionsQueryKey(fieldPath, dataSource, deps, keyword);
  }, [fieldPath, dataSource, deps, keyword]);

  // 判断是否应该自动获取
  const shouldFetch = useMemo(() => {
    // 静态数据不需要请求
    if (staticEnum && staticEnum.length > 0) return false;
    if (!dataSource) return false;
    if (dataSource.strategy === 'static') return false;
    if (!enabled) return false;

    return shouldAutoFetch(dataSource);
  }, [staticEnum, dataSource, enabled]);

  // Query 函数
  const queryFn = useCallback(async () => {
    if (!dataSource?.request) {
      throw new Error('No request config provided for remote data source');
    }

    const client = requestClient;
    if (!client) {
      throw new Error(
        '[Universal Filter] Missing requestClient. Wrap your app with <FilterConfigure value={{ options: { requestClient } }}> and ensure requestClient is provided.'
      );
    }

    const response = await client(dataSource.request, {
      fieldPath,
      keyword,
      deps,
    });

    return transformFn(response);
  }, [dataSource, requestClient, fieldPath, keyword, deps, transformFn]);

  // React Query
  const {
    data: remoteOptions,
    isLoading: isQueryLoading,
    isFetching,
    isError,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey,
    queryFn,
    enabled: shouldFetch,
    staleTime: dataSource?.staleTime ?? optionsContext?.cacheConfig?.staleTime ?? 5 * 60 * 1000,
    gcTime: dataSource?.gcTime ?? optionsContext?.cacheConfig?.gcTime ?? 30 * 60 * 1000,
  });

  // 最终的 options
  const options = useMemo<OptionItem[]>(() => {
    // 优先使用静态枚举
    if (staticEnum && staticEnum.length > 0) {
      return staticEnum;
    }

    // 使用远程数据
    if (remoteOptions) {
      return remoteOptions;
    }

    // 尝试从 Formily field 获取
    if (formilyField && 'dataSource' in formilyField) {
      const fieldDataSource = (formilyField as { dataSource?: unknown }).dataSource;
      if (Array.isArray(fieldDataSource)) {
        return fieldDataSource as OptionItem[];
      }
    }

    return [];
  }, [staticEnum, remoteOptions, formilyField]);

  // 同步到 Formily field.dataSource
  useEffect(() => {
    if (!syncToField || !formilyField) return;
    if (!('setDataSource' in formilyField)) return;

    const field = formilyField as { setDataSource?: (ds: OptionItem[]) => void };
    if (typeof field.setDataSource === 'function' && options.length > 0) {
      field.setDataSource(options);
    }
  }, [options, formilyField, syncToField]);

  // 搜索函数（带防抖）
  const search = useCallback(
    (kw: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      setIsSearching(true);

      const debounceMs = dataSource?.searchDebounce ?? 300;

      debounceTimerRef.current = setTimeout(() => {
        setKeyword(kw);
        setIsSearching(false);
      }, debounceMs);
    },
    [dataSource?.searchDebounce]
  );

  // 预取函数（用于 focus 触发）
  const prefetch = useCallback(() => {
    if (!dataSource?.request) return;

    const prefetchKey = buildOptionsQueryKey(fieldPath, dataSource, deps);

    queryClient.prefetchQuery({
      queryKey: prefetchKey,
      queryFn: async () => {
        const client = requestClient;
        if (!client) {
          throw new Error(
            '[Universal Filter] Missing requestClient. Wrap your app with <FilterConfigure value={{ options: { requestClient } }}> and ensure requestClient is provided.'
          );
        }
        const response = await client(dataSource.request!, {
          fieldPath,
          deps,
        });
        return transformFn(response);
      },
      staleTime: dataSource.staleTime ?? 5 * 60 * 1000,
    });
  }, [dataSource, fieldPath, deps, queryClient, requestClient, transformFn]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    data: remoteOptions,
    options,
    isLoading: isQueryLoading,
    isFetching,
    isError,
    isSearching,
    error: queryError as Error | null,
    search,
    refetch,
    prefetch,
  };
}

export default useOptions;

