/**
 * Recommender — 推荐引擎
 *
 * 职责：
 * - 合并多种信号计算推荐分数
 * - 排序输出推荐结果
 *
 * 推荐逻辑：
 * 1. 顺序推荐（Markov 转移，权重 ×3）
 * 2. 全局频率兜底（权重 ×1）
 * 3. 去除已选筛选器
 * 4. 规则过滤（RuleEngine）
 * 5. 用户偏好权重（可选）
 */

import type { FilterDefs } from '../types/Filter'
import type { Suggestion } from '../types/Suggestion'
import type { BehaviorStore } from './BehaviorStore'
import type { RuleEngine } from './RuleEngine'

const TRANSITION_WEIGHT = 3
const FREQUENCY_WEIGHT = 1

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

  /**
   * 设置/更新用户偏好权重
   */
  setUserPreferences(preferences: Record<string, number> | undefined): void {
    this.userPreferences = preferences
  }

  /**
   * 根据当前 context（已选筛选器列表）推荐下一步筛选器
   */
  recommend(context: string[]): Suggestion[] {
    try {
      if (!Array.isArray(context)) {
        return []
      }

      const contextSet = new Set(context)
      const allKeys = Object.keys(this.filterDefs)

      // 候选集：去除已选筛选器
      const candidates = allKeys.filter((key) => !contextSet.has(key))

      if (candidates.length === 0) {
        return []
      }

      // 获取全局频率
      const frequency = this.behaviorStore.getFrequency()
      const maxFrequency = this._maxValue(frequency) || 1

      // 获取顺序转移分布（基于 context 中最后一个筛选器）
      const lastKey = context.length > 0 ? context[context.length - 1] : null
      const transitions = lastKey ? this.behaviorStore.getTransition(lastKey) : {}
      const maxTransition = this._maxValue(transitions) || 1

      const suggestions: Suggestion[] = []

      for (let i = 0; i < candidates.length; i++) {
        const key = candidates[i]

        // 规则过滤
        if (!this.ruleEngine.isValid(key, context)) {
          continue
        }

        const def = this.filterDefs[key]
        const reasons: string[] = []

        // 1. 顺序推荐分数（归一化后 ×3）
        let transitionScore = 0
        if (transitions[key]) {
          transitionScore = (transitions[key] / maxTransition) * TRANSITION_WEIGHT
          reasons.push('sequence')
        }

        // 2. 全局频率分数（归一化后 ×1）
        let frequencyScore = 0
        if (frequency[key]) {
          frequencyScore = (frequency[key] / maxFrequency) * FREQUENCY_WEIGHT
          reasons.push('frequency')
        }

        // 基础分数
        let score = transitionScore + frequencyScore

        // 考虑 filterDef 中定义的 weight
        if (def.weight !== undefined && def.weight > 0) {
          score *= def.weight
        }

        // 5. 用户偏好权重（只影响排序，不影响候选集合）
        if (this.userPreferences && this.userPreferences[key] !== undefined) {
          score *= this.userPreferences[key]
          reasons.push('preference')
        }

        // 保留 3 位小数精度
        score = Math.round(score * 1000) / 1000

        suggestions.push({
          key,
          label: def.label,
          score,
          reason: reasons.length > 0 ? reasons.join(', ') : undefined,
        })
      }

      // 按分数降序排序
      suggestions.sort((a, b) => b.score - a.score)

      return suggestions
    } catch {
      return []
    }
  }

  /**
   * 获取对象中值的最大值
   */
  private _maxValue(obj: Record<string, number>): number {
    let max = 0
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      const val = obj[keys[i]]
      if (val > max) {
        max = val
      }
    }
    return max
  }
}
