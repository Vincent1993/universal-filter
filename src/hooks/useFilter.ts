import { useContext, useMemo } from 'react';
import { ERROR_CODES, FilterError } from '../core/errors';
import { DEFAULT_NAMESPACE, FilterContext } from '../context';
import type { Draft, FilterApi, UseFilterInput } from '../core/types';

/**
 * useFilter Hook
 *
 * 返回 FilterApi 实例。该实例基于 Formily 的响应式系统构建。
 *
 * 实例获取优先级:
 * 1. input.instance (直接传入的实例)
 * 2. context[namespace] (Context 中指定命名空间的实例)
 * 3. context[default] (Context 中的默认实例)
 *
 * **重要**：此 Hook 遵循 React Rules of Hooks，
 * 所有 hooks 调用都在函数顶层，不在条件分支中。
 *
 * @example
 * ```tsx
 * import { Observer } from '@formily/react';
 *
 * function MyComponent() {
 *   const filter = useFilter();
 *
 *   return (
 *     <Observer>
 *       {() => <input value={filter.draft.keyword} />}
 *     </Observer>
 *   );
 * }
 * ```
 */
export function useFilter<TDraft extends Draft>(
  input?: UseFilterInput<TDraft>
): FilterApi<TDraft> {
  // 所有 hooks 始终在顶层调用，不依赖条件分支
  const contextMap = useContext(FilterContext);

  const instance = useMemo<FilterApi<TDraft>>(() => {
    // 优先级 1: 直接传入的实例
    if (input?.instance) {
      return input.instance as FilterApi<TDraft>;
    }

    // 优先级 2: 指定 namespace
    if (input?.namespace) {
      const key = input.namespace;
      const fromContext = contextMap?.get(key) as FilterApi<TDraft> | undefined;
      if (fromContext) return fromContext;

      throw new FilterError(
        ERROR_CODES.NAMESPACE_NOT_FOUND,
        `命名空间 "${key}" 未注册`
      );
    }

    // 优先级 3: 默认实例
    const defaultContext = contextMap?.get(DEFAULT_NAMESPACE) as
      | FilterApi<TDraft>
      | undefined;
    if (defaultContext) return defaultContext;

    throw new FilterError(
      ERROR_CODES.NO_FILTER_CONTEXT,
      '未找到可用的 Filter 实例'
    );
  }, [input?.instance, input?.namespace, contextMap]);

  return instance;
}
