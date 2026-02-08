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
import type { OptionsRuntimeConfig } from '../hooks/useOptions';

// ==================== Constants ====================
export const DEFAULT_NAMESPACE = '__default__';

// ==================== Types ====================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FilterContextMap = Map<string, FilterApi<any>>;

interface ConfigureValue<TDraft extends Draft> {
  defaults: GlobalDefaults<TDraft>;
  mergeStrategy: {
    plugins: 'prepend' | 'append';
    listeners: 'shallow' | 'deep';
  };
  options?: OptionsRuntimeConfig;
}

// ==================== Module-level global configure ====================
// 使用模块级变量替代 React Context._currentValue 内部属性访问
// 这避免了依赖 React 内部实现细节

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
let _globalConfigure: ConfigureValue<any> = DEFAULT_CONFIGURE;

// ==================== Context ====================
export const FilterContext = createContext<FilterContextMap | null>(null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ConfigureContext = createContext<ConfigureValue<any>>(DEFAULT_CONFIGURE);

// ==================== FilterConfigure Component ====================
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

  // 同步到模块级变量，供非 React 上下文（如 createFilter）使用
  _globalConfigure = contextValue;

  return React.createElement(ConfigureContext.Provider, { value: contextValue, children });
}

// ==================== FilterProvider Component ====================
export function FilterProvider<TDraft extends Draft = Draft>(props: FilterProviderProps<TDraft>): ReactElement {
  const { instance, namespace, children, fallback, onError, onReset, resetKeys } = props;
  const parentMap = useContext(FilterContext);

  const contextMap = useMemo<FilterContextMap>(() => {
    const next = new Map<string, FilterApi<TDraft>>(parentMap ?? undefined);
    const key = namespace ?? DEFAULT_NAMESPACE;
    next.set(key, instance as FilterApi<TDraft>);
    return next;
  }, [instance, namespace, parentMap]);

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
export function useConfigure<TDraft extends Draft>(): ConfigureValue<TDraft> {
  return useContext(ConfigureContext) as ConfigureValue<TDraft>;
}

/**
 * getGlobalConfigure - 获取全局配置（非 Hook 版本）
 *
 * 使用模块级变量替代 React Context._currentValue，
 * 避免依赖 React 内部实现细节。
 *
 * @internal
 */
export function getGlobalConfigure<TDraft extends Draft>(): ConfigureValue<TDraft> {
  return _globalConfigure as ConfigureValue<TDraft>;
}

/**
 * 设置全局配置（仅用于测试）
 * @internal
 */
export function setGlobalConfigureForTest<TDraft extends Draft>(config: Partial<ConfigureValue<TDraft>>): void {
  _globalConfigure = {
    ...DEFAULT_CONFIGURE,
    ...config,
    defaults: {
      ...DEFAULT_CONFIGURE.defaults,
      ...(config.defaults || {}),
    } as GlobalDefaults<TDraft>,
  };
}
