/**
 * RuleEngine — 规则引擎
 *
 * 职责：
 * - 校验筛选器是否可在当前 context 下使用
 * - 只处理 dependsOn 规则
 * - 支持批量查询可用筛选器
 */

import type { FilterDefs } from '../types/Filter'

export class RuleEngine {
  private filterDefs: FilterDefs

  constructor(filterDefs: FilterDefs) {
    this.filterDefs = filterDefs
  }

  /**
   * 判断 key 对应的筛选器在当前 context 下是否可用
   * - 如果 filterDef 定义了 dependsOn，则所有依赖必须已在 context 中
   * - 如果没有定义 dependsOn，默认可用
   * - 如果 key 未在 filterDefs 中注册，返回 false
   */
  isValid(key: string, context: string[]): boolean {
    if (typeof key !== 'string') {
      return false
    }

    const def = this.filterDefs[key]
    if (!def) {
      return false
    }

    const deps = def.dependsOn
    if (!deps || deps.length === 0) {
      return true
    }

    // 使用 Set 加速依赖查找（O(1) vs O(n)）
    const contextSet = context.length > 4 ? new Set(context) : null

    for (let i = 0; i < deps.length; i++) {
      const found = contextSet ? contextSet.has(deps[i]) : context.includes(deps[i])
      if (!found) {
        return false
      }
    }

    return true
  }

  /**
   * 批量返回当前 context 下所有可用的筛选器 key
   * 排除已在 context 中的筛选器
   */
  getAvailable(context: string[]): string[] {
    if (!Array.isArray(context)) {
      return []
    }

    const contextSet = new Set(context)
    const allKeys = Object.keys(this.filterDefs)
    const result: string[] = []

    for (let i = 0; i < allKeys.length; i++) {
      const key = allKeys[i]
      if (!contextSet.has(key) && this.isValid(key, context)) {
        result.push(key)
      }
    }

    return result
  }
}
