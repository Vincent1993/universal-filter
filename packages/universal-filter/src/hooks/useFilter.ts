import { useContext, useSyncExternalStore } from 'react';
import { ERROR_CODES, FilterError } from '../core/errors';
import { useConfigure, DEFAULT_NAMESPACE, FilterContext } from '../context';
import type { Draft, FilterApi, UseFilterInput } from '../core/types';

// 为每个 filter 实例维护订阅状态
const instanceStores = new WeakMap<
  FilterApi<any>,
  {
    version: number;
    listeners: Set<() => void>;
    subscriptionId: number | null;
  }
>();

function getOrCreateStore<TDraft extends Draft>(instance: FilterApi<TDraft>) {
  if (!instanceStores.has(instance)) {
    const store = {
      version: 0,
      listeners: new Set<() => void>(),
      subscriptionId: null as number | null,
    };

    // 只在第一次创建时订阅
    store.subscriptionId = instance.form.subscribe(() => {
      store.version++;
      // 通知所有监听器
      store.listeners.forEach((listener) => listener());
    });

    instanceStores.set(instance, store);
  }
  return instanceStores.get(instance)!;
}

function useFilterInstance<TDraft extends Draft>(
  input?: UseFilterInput<TDraft>
): FilterApi<TDraft> {
  if (input?.instance) {
    return input.instance;
  }

  const contextMap = useContext(FilterContext);
  const configure = useConfigure<TDraft>();

  if (input?.namespace) {
    const key = input.namespace;
    const fromContext = contextMap?.get(key) as FilterApi<TDraft> | undefined;
    if (fromContext) {
      return fromContext;
    }
    const fromRegistry = configure.registry.get(key) as
      | FilterApi<TDraft>
      | undefined;
    if (fromRegistry) {
      return fromRegistry;
    }
    throw new FilterError(
      ERROR_CODES.NAMESPACE_NOT_FOUND,
      `Namespace "${key}" is not registered`
    );
  }

  const defaultContext = contextMap?.get(DEFAULT_NAMESPACE) as
    | FilterApi<TDraft>
    | undefined;
  if (defaultContext) {
    return defaultContext;
  }

  const defaultRegistry = configure.registry.getDefault() as
    | FilterApi<TDraft>
    | undefined;
  if (defaultRegistry) {
    return defaultRegistry;
  }

  throw new FilterError(
    ERROR_CODES.NO_FILTER_CONTEXT,
    'No filter instance available in context'
  );
}

export function useFilter<TDraft extends Draft>(
  input?: UseFilterInput<TDraft>
): FilterApi<TDraft> {
  const instance = useFilterInstance<TDraft>(input);
  const store = getOrCreateStore(instance);

  // 使用 useSyncExternalStore 订阅版本变化
  useSyncExternalStore(
    (onStoreChange) => {
      // 添加监听器
      store.listeners.add(onStoreChange);

      // 返回清理函数
      return () => {
        store.listeners.delete(onStoreChange);
      };
    },
    // getSnapshot: 返回当前版本号
    () => store.version,
    // getServerSnapshot: SSR 场景
    () => store.version
  );

  return instance;
}
