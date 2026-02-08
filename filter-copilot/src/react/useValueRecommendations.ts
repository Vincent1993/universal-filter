/**
 * useValueRecommendations — 值排序推荐 hook
 *
 * 声明式获取"某个筛选器内各值应如何排序"的推荐结果。
 * 典型用途：下拉列表选项重排序。
 *
 * @example
 * ```tsx
 * const brandOptions = ['Apple', 'Samsung', 'Huawei', 'Xiaomi']
 * const context = [{ key: 'category', value: '手机' }]
 * const { values } = useValueRecommendations('brand', context, brandOptions)
 * // values: [{ value: 'Apple', score: 3.5 }, { value: 'Samsung', score: 2.1 }, ...]
 * // 直接用 values.map(v => v.value) 作为下拉列表的排序
 * ```
 */

import { useMemo, useCallback, useState } from 'react'
import type { FilterSelection } from '../types/Filter'
import type { ValueSuggestion } from '../types/Suggestion'
import type { RecommendValuesOptions } from '../core/Recommender'
import { useFilterCopilotContext } from './context'

export interface UseValueRecommendationsReturn {
  /** 按推荐分数排序的值列表 */
  values: ValueSuggestion[]
  /** SDK 是否就绪 */
  ready: boolean
  /** 手动刷新 */
  refresh: () => void
}

export function useValueRecommendations(
  targetKey: string,
  context: FilterSelection[],
  allValues?: string[],
  options?: RecommendValuesOptions,
): UseValueRecommendationsReturn {
  const { copilot, ready } = useFilterCopilotContext()
  const [version, setVersion] = useState(0)

  const values = useMemo(() => {
    void version
    if (!copilot || !ready) return []
    try {
      return copilot.recommendValues(targetKey, context, allValues, options)
    } catch {
      return []
    }
  }, [copilot, ready, targetKey, context, allValues, options, version])

  const refresh = useCallback(() => {
    setVersion((v) => v + 1)
  }, [])

  return { values, ready, refresh }
}
