/**
 * Recommender — 双维度推荐引擎
 *
 * 维度 1：筛选器推荐（recommend）
 *   "接下来应该用哪个筛选器？"
 *   信号：Markov 转移 ×3 + 上下文转移 ×2 + 全局频率 ×1
 *
 * 维度 2：值推荐（recommendValues）
 *   "这个下拉列表里哪些值应该排在前面？"
 *   信号：上下文值共现 ×3 + 全局值频率 ×1
 */

import type { FilterDefs, FilterSelection } from '../types/Filter'
import type { Suggestion, ValueSuggestion } from '../types/Suggestion'
import type { BehaviorStore } from './BehaviorStore'
import type { RuleEngine } from './RuleEngine'

// 权重常量
const TRANSITION_WEIGHT = 3
const CONTEXT_TRANSITION_WEIGHT = 2
const FREQUENCY_WEIGHT = 1
const VALUE_CONTEXT_WEIGHT = 3
const VALUE_FREQUENCY_WEIGHT = 1

export interface RecommendOptions {
  maxResults?: number
}

export interface RecommendValuesOptions {
  maxResults?: number
}

export class Recommender {
  private filterDefs: FilterDefs
  private behaviorStore: BehaviorStore
  private ruleEngine: RuleEngine
  private userPreferences: Record<string, number> | undefined

  constructor(
    filterDefs: FilterDefs,
    behaviorStore: BehaviorStore,
    ruleEngine: RuleEngine,
    userPreferences?: Record<string, number>,
  ) {
    this.filterDefs = filterDefs
    this.behaviorStore = behaviorStore
    this.ruleEngine = ruleEngine
    this.userPreferences = userPreferences
  }

  setUserPreferences(preferences: Record<string, number> | undefined): void {
    this.userPreferences = preferences
  }

  // ──────────────── 维度 1：筛选器推荐 ────────────────

  /**
   * 推荐下一步应使用的筛选器
   *
   * context 支持两种形式（向后兼容）：
   *   string[]            — 仅 key，使用 Markov 转移 + 频率
   *   FilterSelection[]   — key+value，额外利用上下文转移信号
   */
  recommend(context: string[] | FilterSelection[], options?: RecommendOptions): Suggestion[] {
    try {
      if (!Array.isArray(context)) return []

      const { keys, selections } = this._normalizeContext(context)
      const contextSet = new Set(keys)
      const allKeys = Object.keys(this.filterDefs)
      const candidates = allKeys.filter((k) => !contextSet.has(k))
      if (candidates.length === 0) return []

      // ── 信号 1：Markov 转移（基于最后一个 key）──
      const lastKey = keys.length > 0 ? keys[keys.length - 1] : null
      const transitions = lastKey ? this.behaviorStore.getTransition(lastKey) : {}
      const maxTransition = this._maxValue(transitions) || 1

      // ── 信号 2：上下文转移（基于 key+value）──
      const ctxTransitionScores: Record<string, number> = {}
      if (selections.length > 0) {
        for (const sel of selections) {
          const values = this._toStringArray(sel.value)
          for (const v of values) {
            const ct = this.behaviorStore.getContextTransition(sel.key, v)
            const ctKeys = Object.keys(ct)
            for (let i = 0; i < ctKeys.length; i++) {
              ctxTransitionScores[ctKeys[i]] = (ctxTransitionScores[ctKeys[i]] ?? 0) + ct[ctKeys[i]]
            }
          }
        }
      }
      const maxCtxTransition = this._maxValue(ctxTransitionScores) || 1

      // ── 信号 3：全局频率 ──
      const frequency = this.behaviorStore.getFrequency()
      const maxFrequency = this._maxValue(frequency) || 1

      // ── 评分 ──
      const suggestions: Suggestion[] = []

      for (let i = 0; i < candidates.length; i++) {
        const key = candidates[i]
        if (!this.ruleEngine.isValid(key, keys)) continue

        const def = this.filterDefs[key]
        const reasons: string[] = []
        let score = 0

        // Markov 转移
        if (transitions[key]) {
          score += (transitions[key] / maxTransition) * TRANSITION_WEIGHT
          reasons.push('sequence')
        }

        // 上下文转移
        if (ctxTransitionScores[key]) {
          score += (ctxTransitionScores[key] / maxCtxTransition) * CONTEXT_TRANSITION_WEIGHT
          reasons.push('context')
        }

        // 全局频率
        if (frequency[key]) {
          score += (frequency[key] / maxFrequency) * FREQUENCY_WEIGHT
          reasons.push('frequency')
        }

        // filterDef.weight
        if (def.weight !== undefined && def.weight > 0) {
          score *= def.weight
        }

        // 用户偏好
        if (this.userPreferences && this.userPreferences[key] !== undefined) {
          score *= this.userPreferences[key]
          reasons.push('preference')
        }

        score = Math.round(score * 1000) / 1000

        suggestions.push({
          key,
          label: def.label,
          score,
          reason: reasons.length > 0 ? reasons.join(', ') : undefined,
        })
      }

      // 稳定排序
      suggestions.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
      })

      const max = options?.maxResults
      if (max !== undefined && max > 0 && suggestions.length > max) {
        return suggestions.slice(0, max)
      }

      return suggestions
    } catch {
      return []
    }
  }

  // ──────────────── 维度 2：值推荐 ────────────────

  /**
   * 推荐某个筛选器内各值的排序
   *
   * 典型用途：下拉列表选项排序、多选面板的推荐排序
   *
   * @param targetKey   目标筛选器 key（要排序哪个筛选器的值）
   * @param context     当前已选中的筛选器（带值）
   * @param allValues   该筛选器的全部可选值（未提供则只返回有数据的值）
   * @param options     maxResults 等
   */
  recommendValues(
    targetKey: string,
    context: FilterSelection[],
    allValues?: string[],
    options?: RecommendValuesOptions,
  ): ValueSuggestion[] {
    try {
      if (typeof targetKey !== 'string') return []
      if (!Array.isArray(context)) context = []

      // ── 信号 1：全局值频率 ──
      const globalValueFreq = this.behaviorStore.getValueFrequency(targetKey)
      const maxGlobalFreq = this._maxValue(globalValueFreq) || 1

      // ── 信号 2：上下文值共现 ──
      const contextValueScores: Record<string, number> = {}
      for (const sel of context) {
        if (!sel || typeof sel.key !== 'string') continue
        const values = this._toStringArray(sel.value)
        for (const v of values) {
          const pairs = this.behaviorStore.getValuePairs(sel.key, v, targetKey)
          const pKeys = Object.keys(pairs)
          for (let i = 0; i < pKeys.length; i++) {
            contextValueScores[pKeys[i]] =
              (contextValueScores[pKeys[i]] ?? 0) + pairs[pKeys[i]]
          }
        }
      }
      const maxCtxValue = this._maxValue(contextValueScores) || 1

      // ── 构建候选值集合 ──
      const candidateSet = new Set<string>()
      if (allValues && allValues.length > 0) {
        for (const v of allValues) candidateSet.add(v)
      }
      // 添加有数据的值
      for (const v of Object.keys(globalValueFreq)) candidateSet.add(v)
      for (const v of Object.keys(contextValueScores)) candidateSet.add(v)

      // ── 评分 ──
      const suggestions: ValueSuggestion[] = []

      for (const value of candidateSet) {
        const reasons: string[] = []
        let score = 0

        // 全局值频率
        if (globalValueFreq[value]) {
          score += (globalValueFreq[value] / maxGlobalFreq) * VALUE_FREQUENCY_WEIGHT
          reasons.push('frequency')
        }

        // 上下文值共现
        if (contextValueScores[value]) {
          score += (contextValueScores[value] / maxCtxValue) * VALUE_CONTEXT_WEIGHT
          reasons.push('context')
        }

        score = Math.round(score * 1000) / 1000

        suggestions.push({
          value,
          score,
          reason: reasons.length > 0 ? reasons.join(', ') : undefined,
        })
      }

      // 稳定排序
      suggestions.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return a.value < b.value ? -1 : a.value > b.value ? 1 : 0
      })

      const max = options?.maxResults
      if (max !== undefined && max > 0 && suggestions.length > max) {
        return suggestions.slice(0, max)
      }

      return suggestions
    } catch {
      return []
    }
  }

  // ──────────────── 内部工具 ────────────────

  /**
   * 兼容两种 context 格式
   */
  private _normalizeContext(context: string[] | FilterSelection[]): {
    keys: string[]
    selections: FilterSelection[]
  } {
    if (context.length === 0) return { keys: [], selections: [] }
    if (typeof context[0] === 'string') {
      return { keys: context as string[], selections: [] }
    }
    const sels = context as FilterSelection[]
    return { keys: sels.map((s) => s.key), selections: sels }
  }

  private _toStringArray(value: string | string[] | undefined): string[] {
    if (!value) return []
    if (typeof value === 'string') return value ? [value] : []
    if (Array.isArray(value)) return value.filter((v) => typeof v === 'string' && v !== '')
    return []
  }

  private _maxValue(obj: Record<string, number>): number {
    let max = 0
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      if (obj[keys[i]] > max) max = obj[keys[i]]
    }
    return max
  }
}
