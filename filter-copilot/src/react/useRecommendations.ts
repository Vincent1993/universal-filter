/**
 * useRecommendations — 推荐 hook
 *
 * 声明式获取推荐结果，context 变化时自动重算。
 * Headless 设计：只返回数据，UI 完全由消费者控制。
 */

import { useMemo, useCallback, useState } from 'react'
import type { Suggestion } from '../types/Suggestion'
import type { RecommendOptions } from '../core/Recommender'
import { useFilterCopilotContext } from './context'

export interface UseRecommendationsReturn {
  /** 推荐结果列表 */
  suggestions: Suggestion[]
  /** SDK 是否就绪 */
  ready: boolean
  /** 手动触发重新推荐（例如在 record 之后） */
  refresh: () => void
}

/**
 * 声明式获取筛选器推荐
 *
 * @param context 当前已选中的筛选器 key 数组
 * @param options 推荐选项（maxResults 等）
 *
 * @example
 * ```tsx
 * const { suggestions, refresh } = useRecommendations(['category'], { maxResults: 5 })
 * // suggestions: [{ key: 'brand', label: '品牌', score: 3.5 }, ...]
 * ```
 */
export function useRecommendations(
  context: string[],
  options?: RecommendOptions,
): UseRecommendationsReturn {
  const { copilot, ready } = useFilterCopilotContext()

  // 用于触发强制重新计算的版本号
  const [version, setVersion] = useState(0)

  const suggestions = useMemo(() => {
    // version 作为依赖以支持 refresh 强制重算
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
