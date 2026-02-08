/**
 * useOptions Hook - 统一的数据源获取 Hook
 *
 * 支持：
 * - 静态数据
 * - 远程数据（首次加载、按需加载、搜索、依赖刷新）
 * - 自定义请求客户端
 * - 与 Formily field.setDataSource 集成
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Schema, type ISchema } from '@formily/json-schema';
import { useDebounceFn } from 'ahooks';
import { cloneDeep, uniqBy } from 'es-toolkit';

import { useOptionsContext } from '../../context';
import { useField } from '../useField';
import { useFilter } from '../useFilter';
import type {
  UseOptionsConfig,
  UseOptionsResult,
  RequestClient,
  OptionSourceConfig,
  CompiledRequestConfig,
  OptionItem,
  OptionRequestConfig,
  OptionQueryKey,
  OptionTrigger,
} from './types';

export type {
  OptionStrategy,
  OptionTrigger,
  OptionRequestConfig,
  OptionItem,
  OptionRequestContext,
  RequestClient,
  OptionTransform,
  OptionSourceConfig,
  UseOptionsConfig,
  UseOptionsResult,
  OptionsRuntimeConfig,
} from './types';

// ==================== Helper Functions ====================

/**
 * 解析请求配置，使用 Formily Schema 编译动态表达式
 */
const resolveRequestConfig = (
  request: NonNullable<OptionSourceConfig['request']>,
  scope: Record<string, unknown>,
) => {
  const requestSchema = new Schema({
    type: 'object',
    properties: {
      request,
    },
  } as unknown as ISchema);
  const json = (requestSchema.properties as any).request.compile(scope).toJSON();

  return json;
};

/**
 * 构建 React Query 的 queryKey
 */
export function buildOptionsQueryKey(
  fieldPath: string,
  config: OptionSourceConfig,
  deps?: Record<string, unknown>,
  keyword?: string,
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

  if (keyword?.trim()) {
    key.push({ keyword });
  }

  return key as OptionQueryKey;
}

/**
 * 判断是否应该自动获取数据
 */
export function shouldAutoFetch(config: OptionSourceConfig, trigger?: OptionTrigger): boolean {
  const effectiveTrigger = trigger ?? config.trigger ?? 'mount';

  if (config.strategy === 'static') {
    return false;
  }

  return effectiveTrigger === 'mount';
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
export function useOptions(params: UseOptionsConfig): UseOptionsResult {
  const { fieldPath, dataSource, staticEnum, deps } = params;

  // ==================== 1. 基础状态与上下文 ====================

  const filter = useFilter();
  const enhancedField = useField();
  const optionsContext = useOptionsContext();
  const [searchTerm, setSearchTerm] = useState<string>();

  // ==================== 2. 字段路径与作用域处理 ====================

  const resolvedFieldPath = fieldPath ?? enhancedField.address?.entire;
  const effectiveFieldPath =
    typeof resolvedFieldPath === 'string' ? resolvedFieldPath : String(resolvedFieldPath);

  const fieldScope = useMemo(() => enhancedField?.scope ?? {}, [enhancedField]);

  // 使用 form.getValuesIn 获取当前字段的值，这里不需要 cloneDeep，formily 的值已经是代理的
  // 并且使用 useMemo 依赖 enhancedField.form.values 来确保响应式更新
  const currentValue = enhancedField.form.getValuesIn(effectiveFieldPath);

  const initialValues = useMemo(
    () => cloneDeep(currentValue),
    // 依赖项中添加 currentValue，确保值变化时 initialValues 更新
    // 注意：这里可能需要根据实际场景决定是否需要对 currentValue 进行深比较或者只依赖它的引用
    // 如果是 formily 的 observable 对象，引用可能不变，但内容变了。
    // 为了安全起见，我们依赖 JSON.stringify(currentValue) 或者使用 useDeepCompareMemo
    // 这里暂时使用 JSON.stringify 作为简单解法，或者假设 getValuesIn 返回的是 plain object 如果不是 observable
    [currentValue],
  );

  const scopedDependencies = useMemo(
    () => ({
      ...fieldScope,
      ...(deps ?? {}),
      $initialValues: initialValues,
      $searchTerm: searchTerm,
    }),
    [fieldScope, deps, initialValues, searchTerm],
  );

  // ==================== 3. 请求客户端与验证 ====================

  const requestClient = useMemo<RequestClient | null>(() => {
    if (!optionsContext) return null;
    return optionsContext.requestClient;
  }, [optionsContext]);

  if (dataSource && dataSource.strategy !== 'static' && !requestClient) {
    throw new Error(
      '[Universal Filter] 缺少请求客户端配置。请使用 <FilterConfigure value={{ options: { requestClient } }}> 包裹应用并提供 requestClient。',
    );
  }

  // ==================== 4. 缓存配置 ====================

  const cacheStaleTime = dataSource?.staleTime ?? 5 * 60 * 1000;
  const cacheGcTime = dataSource?.gcTime ?? 30 * 60 * 1000;

  // ==================== 5. 请求构建与执行 ====================

  const queryContext = useMemo(
    () => ({
      fieldPath: effectiveFieldPath,
      deps,
    }),
    [effectiveFieldPath, deps],
  );

  const buildRequestConfig = useCallback(
    (extraScope?: Record<string, unknown>): CompiledRequestConfig => {
      if (!dataSource?.request) {
        throw new Error('[Universal Filter] 远程数据源缺少请求配置。');
      }

      return resolveRequestConfig(dataSource.request, {
        ...scopedDependencies,
        ...(extraScope ?? {}),
      }) as unknown as CompiledRequestConfig;
    },
    [dataSource, scopedDependencies],
  );

  const executeRequest = useCallback(
    async (
      extraScope?: Record<string, unknown>,
      configMapper?: (config: CompiledRequestConfig) => CompiledRequestConfig,
    ) => {
      if (!requestClient) {
        throw new Error(
          '[Universal Filter] 缺少请求客户端。请使用 <FilterConfigure value={{ options: { requestClient } }}> 包裹应用并确保 requestClient 已提供。',
        );
      }

      const requestConfig = buildRequestConfig(extraScope);
      const finalConfig = configMapper ? configMapper(requestConfig) : requestConfig;

      return await requestClient(finalConfig as OptionRequestConfig, queryContext);
    },
    [requestClient, buildRequestConfig, queryContext],
  );

  // ==================== 6. 数据转换 ====================

  const transformResponse = useCallback(
    (raw: unknown) => {
      if (dataSource?.transform) {
        return Schema.compile(dataSource.transform, {
          rawResponse: raw,
          $dataSource: {
            raw,
          },
          ...fieldScope,
        });
      }
      return raw;
    },
    [dataSource?.transform, fieldScope],
  );

  // ==================== 7. 主查询配置 ====================

  const queryKey = useMemo(() => {
    if (!dataSource) return ['options', effectiveFieldPath];
    return buildOptionsQueryKey(effectiveFieldPath, dataSource, deps, searchTerm);
  }, [effectiveFieldPath, dataSource, deps, searchTerm]);

  const shouldFetch = useMemo(() => {
    if (staticEnum && staticEnum.length > 0) return false;
    if (!dataSource || dataSource.strategy === 'static') return false;
    if (dataSource.strategy === 'remote-search' && !searchTerm) return false;

    return shouldAutoFetch(dataSource);
  }, [staticEnum, dataSource, searchTerm]);

  const queryFn = useCallback(async () => {
    return (await executeRequest(scopedDependencies, (config) => {
      return {
        ...config,
        data: config.data,
      };
    })) as OptionItem[];
  }, [executeRequest, scopedDependencies]);

  const queryResult = useQuery<OptionItem[], Error>({
    queryKey,
    queryFn,
    enabled: shouldFetch,
    staleTime: cacheStaleTime,
    gcTime: cacheGcTime,
    select: transformResponse,
  });

  // ==================== 8. 预取查询配置 ====================

  const hasInitialValues = useMemo(() => {
    if (initialValues === undefined || initialValues === null) return false;
    if (Array.isArray(initialValues)) return initialValues.length > 0;
    if (typeof initialValues === 'object') {
      return Object.keys(initialValues).length > 0;
    }
    if (typeof initialValues === 'string') {
      return initialValues !== '';
    }
    return true;
  }, [initialValues]);

  const shouldPrefetch = useMemo(() => {
    if (!dataSource?.request) return false;
    return hasInitialValues;
  }, [dataSource, hasInitialValues]);

  const prefetchQueryKey = useMemo(
    () =>
      [
        'options',
        'prefetch',
        effectiveFieldPath,
        // 这里关键：依赖 initialValues 的值，而不仅仅是引用。
        // 使用 JSON.stringify 确保值变化时 queryKey 变化，从而触发重新查询
        JSON.stringify(initialValues),
      ].filter(Boolean),
    [effectiveFieldPath, initialValues],
  );

  const prefetchQueryFn = useCallback(async () => {
    return (await executeRequest({ $initialValues: initialValues }, (config) => {
      if (!config?.hydratePayload) {
        return config;
      }

      return {
        ...config,
        data: config.hydratePayload,
      };
    })) as OptionItem[];
  }, [executeRequest, initialValues]);

  const { data: prefetchData } = useQuery<OptionItem[], Error>({
    queryKey: prefetchQueryKey,
    queryFn: prefetchQueryFn,
    enabled: shouldPrefetch,
    staleTime: cacheStaleTime,
    gcTime: cacheGcTime,
    select: transformResponse,
  });

  // ==================== 9. 数据合并与去重 ====================

  const { data } = queryResult;

  const mergeData = useMemo<OptionItem[] | undefined>(() => {
    const prefetched = (prefetchData ?? []) as OptionItem[];
    const fetched = (data ?? []) as OptionItem[];

    if (!prefetched.length && !fetched.length) {
      return data ?? prefetchData;
    }

    return uniqBy(
      [...prefetched, ...fetched].filter(Boolean),
      (item) => item[dataSource?.uniqKey ?? 'value'],
    ) as OptionItem[];
  }, [prefetchData, data, dataSource?.uniqKey]);

  // ==================== 10. 搜索函数 ====================

  const { run: search } = useDebounceFn(setSearchTerm, {
    wait: dataSource?.searchDebounce ?? 300,
  });

  // ==================== 11. Options hooks 集成 ====================

  const prevLoadingRef = useRef(false);

  useEffect(() => {
    const isLoading = queryResult.isFetching;
    if (isLoading && !prevLoadingRef.current) {
      filter.hooks.optionsLoad.call({ fieldPath: effectiveFieldPath });
    }
    prevLoadingRef.current = isLoading;
  }, [queryResult.isFetching, filter, effectiveFieldPath]);

  useEffect(() => {
    if (mergeData && mergeData.length > 0) {
      filter.hooks.optionsLoaded.call({ fieldPath: effectiveFieldPath, data: mergeData });
    }
  }, [mergeData, filter, effectiveFieldPath]);

  useEffect(() => {
    if (queryResult.error) {
      filter.hooks.optionsError.call({ fieldPath: effectiveFieldPath, error: queryResult.error });
    }
  }, [queryResult.error, filter, effectiveFieldPath]);

  // ==================== 12. 返回结果 ====================

  return {
    ...queryResult,
    data: mergeData,
    search,
  } as unknown as UseOptionsResult;
}

export default useOptions;
