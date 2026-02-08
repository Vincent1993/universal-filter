/**
 * sortOptions — 选项排序工具（纯函数）
 *
 * 将任意来源的选项列表与推荐分数合并，输出排序后的 ScoredOption[]。
 *
 * 设计原则：
 * - 纯函数，不发请求，不依赖框架
 * - SDK 核心不关心选项从哪来，只负责评分
 * - 业务方负责获取选项，然后调用此函数排序
 */

import type { FilterSelection } from '../types/Filter'
import type { OptionItem, ScoredOption } from '../types/Option'
import type { ValueSuggestion } from '../types/Suggestion'
import type { FilterCopilotInstance } from '../index'

export interface SortOptionsParams<T = unknown> {
  /** SDK 实例 */
  copilot: FilterCopilotInstance
  /** 目标筛选器 key */
  targetKey: string
  /** 当前已选筛选器上下文 */
  context: FilterSelection[]
  /** 待排序的选项列表（来自枚举 / 接口 / 搜索） */
  options: OptionItem<T>[]
}

/**
 * 将选项列表按推荐分数排序
 *
 * @returns 排序后的 ScoredOption[]，推荐分高的在前
 *
 * @example
 * ```ts
 * // 枚举型
 * const sorted = sortOptions({
 *   copilot,
 *   targetKey: 'gender',
 *   context: [],
 *   options: [{ label: '男', value: 'male' }, { label: '女', value: 'female' }],
 * })
 *
 * // 接口返回的品牌列表
 * const brands = await fetchBrands(categoryId)
 * const sorted = sortOptions({
 *   copilot,
 *   targetKey: 'brand',
 *   context: [{ key: 'category', value: '手机' }],
 *   options: brands.map(b => ({ label: b.name, value: b.id })),
 * })
 * ```
 */
export function sortOptions<T = unknown>(params: SortOptionsParams<T>): ScoredOption<T>[] {
  const { copilot, targetKey, context, options } = params

  if (!options || options.length === 0) return []

  // 获取推荐分数
  const allValues = options.map((o) => o.value)
  let scores: ValueSuggestion[]
  try {
    scores = copilot.recommendValues(targetKey, context, allValues)
  } catch {
    scores = []
  }

  // 构建 value → score 映射
  const scoreMap = new Map<string, { score: number; reason?: string }>()
  for (const s of scores) {
    scoreMap.set(s.value, { score: s.score, reason: s.reason })
  }

  // 合并原始选项 + 分数
  const result: ScoredOption<T>[] = options.map((opt) => {
    const rec = scoreMap.get(opt.value)
    return {
      ...opt,
      score: rec?.score ?? 0,
      reason: rec?.reason,
    }
  })

  // 排序：推荐分降序；同分保持原始顺序（稳定排序）
  result.sort((a, b) => b.score - a.score)

  return result
}

/**
 * 将搜索结果与推荐分数合并
 *
 * 搜索场景的特殊处理：
 * - 搜索结果的相关性已由后端排序
 * - 推荐分数作为「置顶加成」而非完全重排
 * - boostFactor 控制推荐对搜索排序的影响程度
 *
 * @example
 * ```ts
 * const searchResults = await searchBrands('app')
 * const sorted = mergeSearchResults({
 *   copilot,
 *   targetKey: 'brand',
 *   context: [{ key: 'category', value: '手机' }],
 *   results: searchResults,
 *   boostFactor: 0.3, // 推荐只占 30% 影响力
 * })
 * ```
 */
export interface MergeSearchParams<T = unknown> {
  copilot: FilterCopilotInstance
  targetKey: string
  context: FilterSelection[]
  /** 搜索结果（已按搜索相关性排序） */
  results: OptionItem<T>[]
  /**
   * 推荐分数的加成系数（0~1）
   * - 0: 完全忽略推荐，保持搜索原始排序
   * - 1: 推荐分数完全主导排序
   * - 0.3: 推荐占 30%，搜索相关性占 70%（推荐值）
   * @default 0.3
   */
  boostFactor?: number
}

export function mergeSearchResults<T = unknown>(params: MergeSearchParams<T>): ScoredOption<T>[] {
  const { copilot, targetKey, context, results, boostFactor = 0.3 } = params

  if (!results || results.length === 0) return []

  // 获取推荐分数
  const allValues = results.map((o) => o.value)
  let scores: ValueSuggestion[]
  try {
    scores = copilot.recommendValues(targetKey, context, allValues)
  } catch {
    scores = []
  }

  const scoreMap = new Map<string, { score: number; reason?: string }>()
  for (const s of scores) {
    scoreMap.set(s.value, { score: s.score, reason: s.reason })
  }

  // 找到最大推荐分（用于归一化）
  let maxRecScore = 0
  for (const s of scores) {
    if (s.score > maxRecScore) maxRecScore = s.score
  }
  maxRecScore = maxRecScore || 1

  // 合并分数：搜索排名分 + 推荐加成
  const total = results.length
  const factor = Math.max(0, Math.min(1, boostFactor))

  const result: ScoredOption<T>[] = results.map((opt, index) => {
    const rec = scoreMap.get(opt.value)
    const recScore = rec?.score ?? 0

    // 搜索排名分：越靠前分越高（归一化到 0~1）
    const searchScore = (total - index) / total
    // 推荐加成：归一化后按 boostFactor 加权
    const boostScore = (recScore / maxRecScore) * factor

    // 综合分 = 搜索相关性 × (1 - factor) + 推荐加成
    const combinedScore = Math.round((searchScore * (1 - factor) + boostScore) * 1000) / 1000

    return {
      ...opt,
      score: combinedScore,
      reason: rec?.reason,
    }
  })

  // 按综合分排序
  result.sort((a, b) => b.score - a.score)

  return result
}
