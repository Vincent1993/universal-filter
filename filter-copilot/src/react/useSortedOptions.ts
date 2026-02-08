/**
 * useSortedOptions — 通用选项排序 hook
 *
 * 接受外部传入的选项列表（无论来源），用推荐分数排序后返回。
 * 适用于业务方自行管理数据获取流程的场景。
 *
 * @example
 * ```tsx
 * // 枚举型
 * const { sortedOptions } = useSortedOptions('gender', context, staticOptions)
 *
 * // 接口返回后排序
 * const { data: brands } = useQuery(['brands', categoryId], fetchBrands)
 * const { sortedOptions } = useSortedOptions('brand', context, brands ?? [])
 * ```
 */

import { useMemo, useState, useCallback } from 'react'
import type { FilterSelection } from '../types/Filter'
import type { OptionItem, ScoredOption } from '../types/Option'
import { sortOptions } from '../utils/sortOptions'
import { useFilterCopilotContext } from './context'

export interface UseSortedOptionsReturn<T = unknown> {
  /** 按推荐分数排序后的选项 */
  sortedOptions: ScoredOption<T>[]
  /** SDK 是否就绪 */
  ready: boolean
  /** 手动刷新排序 */
  refresh: () => void
}

export function useSortedOptions<T = unknown>(
  targetKey: string,
  context: FilterSelection[],
  options: OptionItem<T>[],
): UseSortedOptionsReturn<T> {
  const { copilot, ready } = useFilterCopilotContext()
  const [version, setVersion] = useState(0)

  const sortedOptions = useMemo(() => {
    void version
    if (!copilot || !ready || !options || options.length === 0) return []
    return sortOptions({ copilot, targetKey, context, options })
  }, [copilot, ready, targetKey, context, options, version])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  return { sortedOptions, ready, refresh }
}
