/**
 * RuleEngine — 规则引擎
 *
 * 职责：
 * - 校验筛选器是否可在当前 context 下使用
 * - 只处理 dependsOn 规则
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

    // 所有依赖项必须已在 context 中存在
    for (let i = 0; i < deps.length; i++) {
      if (!context.includes(deps[i])) {
        return false
      }
    }

    return true
  }
}
