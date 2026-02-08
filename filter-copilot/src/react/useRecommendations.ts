/**
 * useRecommendations — 筛选器推荐 hook
 *
 * 声明式获取"下一步用哪个筛选器"的推荐结果。
 * context 变化时自动重算。支持 key-only 和 key+value 两种模式。
 */

import { useMemo, useCallback, useState } from 'react'
import type { FilterSelection } from '../types/Filter'
import type { Suggestion } from '../types/Suggestion'
import type { RecommendOptions } from '../core/Recommender'
import { useFilterCopilotContext } from './context'

export interface UseRecommendationsReturn {
  suggestions: Suggestion[]
  ready: boolean
  refresh: () => void
}

/**
 * @param context  当前已选筛选器（string[] 或 FilterSelection[]）
 * @param options  推荐选项
 */
export function useRecommendations(
  context: string[] | FilterSelection[],
  options?: RecommendOptions,
): UseRecommendationsReturn {
  const { copilot, ready } = useFilterCopilotContext()
  const [version, setVersion] = useState(0)

  const suggestions = useMemo(() => {
    void version
    if (!copilot || !ready) return []
    try {
      return copilot.recommend(context, options)
    } catch {
      return []
    }
  }, [copilot, ready, context, options, version])

  const refresh = useCallback(() => {
    setVersion((v) => v + 1)
  }, [])

  return { suggestions, ready, refresh }
}
