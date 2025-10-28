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
 * 3. registry[namespace] (Registry 中指定命名空间的实例)
 * 4. context[default] (Context 中的默认实例)
 * 5. registry[default] (Registry 中的默认实例)
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
  // 如果直接传入实例，直接返回
  if (input?.instance) {
    return useMemo(() => input.instance as FilterApi<TDraft>, [input.instance]);
  }

  // 获取上下文
  const contextMap = useContext(FilterContext);

  // 使用 useMemo 计算实例，确保实例引用稳定
  const instance = useMemo<FilterApi<TDraft>>(() => {
    // 如果指定了 namespace
    if (input?.namespace) {
      const key = input.namespace;

      const fromContext = contextMap?.get(key) as FilterApi<TDraft> | undefined;
      if (fromContext) {
        return fromContext;
      }

      // 找不到指定的 namespace，抛出错误
      throw new FilterError(
        ERROR_CODES.NAMESPACE_NOT_FOUND,
        `命名空间 "${key}" 未注册`
      );
    }

    // 没有指定 namespace，查找默认实例
    // 1. 先从 Context 查找默认实例
    const defaultContext = contextMap?.get(DEFAULT_NAMESPACE) as
      | FilterApi<TDraft>
      | undefined;
    if (defaultContext) {
      return defaultContext;
    }

    // 没有可用的实例，抛出错误
    throw new FilterError(
      ERROR_CODES.NO_FILTER_CONTEXT,
      '未找到可用的 Filter 实例'
    );
  }, [input?.namespace, contextMap]);

  return instance;
}
