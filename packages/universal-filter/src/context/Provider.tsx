import React, { createContext, useContext, useMemo, type ReactElement } from 'react';
import { FormProvider, ExpressionScope } from '@formily/react';
import { FilterErrorBoundary } from './ErrorBoundary';
import type {
  FilterApi,
  FilterProviderProps,
  FilterConfigureProps,
  GlobalDefaults,
  Draft,
} from '../core/types';
import type { OptionsRuntimeConfig } from '../core/option-source';

// ==================== Constants ====================
export const DEFAULT_NAMESPACE = '__default__';

// ==================== Types ====================
/**
 * Filter Context Map - 存储命名空间到 Filter 实例的映射
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FilterContextMap = Map<string, FilterApi<any>>;

/**
 * 配置值 - 只包含全局配置，不包含 registry
 */
interface ConfigureValue<TDraft extends Draft> {
  defaults: GlobalDefaults<TDraft>;
  mergeStrategy: {
    plugins: 'prepend' | 'append';
    listeners: 'shallow' | 'deep';
  };
  options?: OptionsRuntimeConfig;
}

// ==================== Context ====================
/**
 * FilterContext - 内部 Context，用于在组件树中传递 Filter 实例映射
 * @internal
 */
export const FilterContext = createContext<FilterContextMap | null>(null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DEFAULT_CONFIGURE: ConfigureValue<any> = {
  defaults: {},
  mergeStrategy: {
    plugins: 'append',
    listeners: 'shallow',
  },
  options: undefined,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ConfigureContext = createContext<ConfigureValue<any>>(DEFAULT_CONFIGURE);

// ==================== FilterConfigure Component ====================
/**
 * FilterConfigure - 全局配置组件
 *
 * 提供全局默认配置和合并策略
 * 注意：registry 是全局单例，不通过此组件传递
 */
export function FilterConfigure<TDraft extends Draft = Draft>(
  props: FilterConfigureProps<TDraft>
): ReactElement {
  const { value, children } = props;

  const contextValue = useMemo<ConfigureValue<TDraft>>(() => {
    const defaults: GlobalDefaults<TDraft> = value?.defaults ?? ({} as GlobalDefaults<TDraft>);

    return {
      defaults,
      mergeStrategy: {
        plugins: value?.mergeStrategy?.plugins ?? DEFAULT_CONFIGURE.mergeStrategy.plugins,
        listeners: value?.mergeStrategy?.listeners ?? DEFAULT_CONFIGURE.mergeStrategy.listeners,
      },
      options: value?.options ?? DEFAULT_CONFIGURE.options,
    };
  }, [value]);

  return React.createElement(ConfigureContext.Provider, { value: contextValue, children });
}

// ==================== FilterProvider Component ====================
/**
 * FilterProvider - Filter 实例提供者
 *
 * 负责将 Filter 实例注入到 React Context 和全局 Registry 中
 * 内置 Error Boundary 防止渲染错误导致整个应用崩溃
 *
 * React 18 特性：
 * - 使用 startTransition 优化错误重置
 * - 支持 resetKeys 自动重置错误状态
 * - 支持自定义重置钩子
 *
 * @param instance - Filter 实例
 * @param namespace - 命名空间（可选）
 * @param children - 子组件
 * @param fallback - 自定义错误回退组件（可选）
 * @param onError - 错误回调函数（可选）
 * @param onReset - 自定义重置钩子（可选）
 * @param resetKeys - 重置键数组（可选）
 */
export function FilterProvider<TDraft extends Draft = Draft>(props: FilterProviderProps<TDraft>): ReactElement {
  const { instance, namespace, children, fallback, onError, onReset, resetKeys } = props;
  const parentMap = useContext(FilterContext);

  // 构建 Context Map
  const contextMap = useMemo<FilterContextMap>(() => {
    const next = new Map<string, FilterApi<TDraft>>(parentMap ?? undefined);
    const key = namespace ?? DEFAULT_NAMESPACE;
    next.set(key, instance as FilterApi<TDraft>);
    return next;
  }, [instance, namespace, parentMap]);

  // FormProvider 在最外层，确保 form 上下文优先级最高
  // FilterContext 在中间层，提供 filter 实例映射
  // ExpressionScope 在最内层，提供表达式作用域（包含 $root 和 $form 引用）
  // ErrorBoundary 包裹所有内容，捕获渲染错误
  return (
    <FilterErrorBoundary
      fallback={fallback}
      onError={onError}
      onReset={onReset}
      resetKeys={resetKeys}
    >
      <FormProvider form={instance.form}>
        <FilterContext.Provider value={contextMap}>
          <ExpressionScope value={{ $root: instance, $form: instance.form }}>
            {children}
          </ExpressionScope>
        </FilterContext.Provider>
      </FormProvider>
    </FilterErrorBoundary>
  );
}

// ==================== Hooks ====================
/**
 * useConfigure - 获取全局配置的 Hook
 * @returns 包含全局默认值和合并策略的配置对象
 */
export function useConfigure<TDraft extends Draft>(): ConfigureValue<TDraft> {
  return useContext(ConfigureContext) as ConfigureValue<TDraft>;
}

/**
 * getGlobalConfigure - 获取全局配置（非 Hook 版本）
 *
 * 注意：不包含 registry，registry 是全局单例，
 * 使用 getGlobalRegistry() 直接访问
 *
 * @returns 包含全局默认值和合并策略的配置对象
 * @internal
 */
export function getGlobalConfigure<TDraft extends Draft>(): ConfigureValue<TDraft> {
  const context = ConfigureContext as unknown as { _currentValue?: ConfigureValue<TDraft> };
  return context._currentValue ?? (DEFAULT_CONFIGURE as ConfigureValue<TDraft>);
}
