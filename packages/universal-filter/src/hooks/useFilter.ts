import { useContext, useMemo } from 'react';
import { ERROR_CODES, FilterError } from '../core/errors';
import { useConfigure, DEFAULT_NAMESPACE, FilterContext } from '../context';
import type { Draft, FilterApi, UseFilterInput } from '../core/types';

/**
 * 获取 FilterApi 实例
 * 优先级: input.instance > context[namespace] > registry[namespace] > context[default] > registry[default]
 */
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

/**
 * useFilter Hook
 *
 * 返回 FilterApi 实例。该实例基于 Formily 的响应式系统构建。
 *
 * **重要提示**：为了实现精确的响应式更新，建议配合 `@formily/react` 的 `Observer` 组件使用。
 *
 * @example
 * ```tsx
 * import { Observer } from '@formily/react';
 *
 * function MyComponent() {
 *   const filter = useFilter();
 *
 *   return (
 *     <div>
 *       <Observer>
 *         {() => (
 *           // 只有 draft.keyword 变化时这部分才会重新渲染
 *           <input value={filter.draft.keyword} />
 *         )}
 *       </Observer>
 *
 *       <Observer>
 *         {() => (
 *           // 只有 changed 状态变化时这部分才会重新渲染
 *           <Badge>{filter.changed ? '已变更' : '未变更'}</Badge>
 *         )}
 *       </Observer>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // 使用指定 namespace
 * const filter = useFilter({ namespace: 'myFilter' });
 *
 * // 使用直接传入的实例
 * const filter = useFilter({ instance: myFilterInstance });
 * ```
 */
export function useFilter<TDraft extends Draft>(
  input?: UseFilterInput<TDraft>
): FilterApi<TDraft> {
  const instance = useFilterInstance<TDraft>(input);

  // 使用 useMemo 确保实例引用稳定
  // FilterApi 实例是稳定的，不应该因为组件重新渲染而改变
  return useMemo(() => instance, [instance]);
}
