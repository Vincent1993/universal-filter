import React, { createContext, useContext, useEffect, useMemo, type ReactElement } from 'react';
import { FormProvider, ExpressionScope } from '@formily/react';
import { createInstanceRegistry } from '../core/registry';
import type {
  FilterApi,
  FilterProviderProps,
  FilterConfigureProps,
  GlobalDefaults,
  InstanceRegistry,
  Draft
} from '../core/types';

// ==================== Constants ====================
export const DEFAULT_NAMESPACE = '__default__';

// ==================== Types ====================
/**
 * Filter Context Map - 存储命名空间到 Filter 实例的映射
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FilterContextMap = Map<string, FilterApi<any>>;

/**
 * 内部配置值 - 包含全局配置和内部管理的 registry
 * @internal
 */
interface InternalConfigureValue<TDraft> {
  defaults: GlobalDefaults<TDraft>;
  registry: InstanceRegistry<TDraft>;
  mergeStrategy: {
    plugins: 'prepend' | 'append';
    listeners: 'shallow' | 'deep';
  };
}

// ==================== Context ====================
/**
 * FilterContext - 内部 Context，用于在组件树中传递 Filter 实例映射
 * @internal
 */
export const FilterContext = createContext<FilterContextMap | null>(null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DEFAULT_CONFIGURE: InternalConfigureValue<any> = {
  defaults: {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registry: createInstanceRegistry<any>(),
  mergeStrategy: {
    plugins: 'append',
    listeners: 'shallow',
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ConfigureContext = createContext<InternalConfigureValue<any>>(DEFAULT_CONFIGURE);

// ==================== FilterConfigure Component ====================
/**
 * FilterConfigure - 全局配置组件
 * 提供全局默认配置和合并策略，registry 由组件内部管理
 */
export function FilterConfigure<TDraft extends Draft = Draft>(
  props: FilterConfigureProps<TDraft>
): ReactElement {
  const { value, children } = props;

  const contextValue = useMemo<InternalConfigureValue<TDraft>>(() => {
    const defaults: GlobalDefaults<TDraft> = value?.defaults ?? ({} as GlobalDefaults<TDraft>);

    return {
      defaults,
      registry: createInstanceRegistry<TDraft>(),
      mergeStrategy: {
        plugins: value?.mergeStrategy?.plugins ?? DEFAULT_CONFIGURE.mergeStrategy.plugins,
        listeners: value?.mergeStrategy?.listeners ?? DEFAULT_CONFIGURE.mergeStrategy.listeners,
      },
    };
  }, [value]);

  return React.createElement(ConfigureContext.Provider, { value: contextValue, children });
}

// ==================== FilterProvider Component ====================
/**
 * FilterProvider - Filter 实例提供者
 * 负责将 Filter 实例注入到 React Context 和全局 Registry 中
 */
export function FilterProvider<TDraft extends Draft = Draft>(props: FilterProviderProps<TDraft>): ReactElement {
  const { instance, namespace, children } = props;
  const configure = useConfigure<TDraft>();
  const parentMap = useContext(FilterContext);

  // 构建 Context Map
  const contextMap = useMemo<FilterContextMap>(() => {
    const next = new Map<string, FilterApi<TDraft>>(parentMap ?? undefined);
    const key = namespace ?? DEFAULT_NAMESPACE;
    next.set(key, instance as FilterApi<TDraft>);
    return next;
  }, [instance, namespace, parentMap]);

  // 注册到全局 Registry
  useEffect(() => {
    if (namespace) {
      configure.registry.set(namespace, instance as FilterApi<TDraft>);
      return () => configure.registry.delete(namespace);
    }
    configure.registry.setDefault(instance as FilterApi<TDraft>);
    return undefined;
  }, [configure.registry, instance, namespace]);

  return (
    <FormProvider form={instance.form}>
      <ExpressionScope value={{ $root: instance }}>
        <FilterContext.Provider value={contextMap}>{children}</FilterContext.Provider>
      </ExpressionScope>
    </FormProvider>
  );
}

// ==================== Hooks ====================
/**
 * useConfigure - 获取全局配置的 Hook
 * @returns 包含全局默认值、registry 和合并策略的配置对象
 */
export function useConfigure<TDraft>(): InternalConfigureValue<TDraft> {
  return useContext(ConfigureContext) as InternalConfigureValue<TDraft>;
}

/**
 * getGlobalConfigure - 获取全局配置（非 Hook 版本）
 * @returns 包含全局默认值、registry 和合并策略的配置对象
 * @internal
 */
export function getGlobalConfigure<TDraft>(): InternalConfigureValue<TDraft> {
  const context = ConfigureContext as unknown as { _currentValue?: InternalConfigureValue<TDraft> };
  return context._currentValue ?? (DEFAULT_CONFIGURE as InternalConfigureValue<TDraft>);
}
