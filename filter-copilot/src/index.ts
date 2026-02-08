/**
 * Filter Copilot SDK
 *
 * 浏览器本地运行的智能筛选器推荐 SDK
 * 唯一对外入口：createFilterCopilot
 */

import type { FilterDefs } from './types/Filter'
import type { FilterAction } from './types/Behavior'
import type { Suggestion } from './types/Suggestion'

import { BehaviorStore } from './core/BehaviorStore'
import { RuleEngine } from './core/RuleEngine'
import { Recommender } from './core/Recommender'
import { createPersistencePlugin } from './plugins/persistence'
import { createUserProfilePlugin } from './plugins/userProfile'

export interface CreateFilterCopilotOptions {
  userId: string
  filterDefs: FilterDefs
  userProfile?: {
    preferredFilters?: Record<string, number>
  }
  persist?: boolean
}

export interface FilterCopilotInstance {
  recommend(context: string[]): Suggestion[]
  record(action: FilterAction): void
  export(): unknown
}

export function createFilterCopilot(options: CreateFilterCopilotOptions): FilterCopilotInstance {
  const { userId, filterDefs, userProfile, persist = false } = options

  // 初始化核心模块
  const behaviorStore = new BehaviorStore()
  const ruleEngine = new RuleEngine(filterDefs)

  // 初始化用户偏好插件
  const userProfilePlugin = userProfile?.preferredFilters
    ? createUserProfilePlugin(userProfile.preferredFilters)
    : undefined

  // 初始化推荐引擎
  const recommender = new Recommender(
    filterDefs,
    behaviorStore,
    ruleEngine,
    userProfilePlugin?.getPreferences(),
  )

  // 初始化持久化插件
  const persistencePlugin = persist ? createPersistencePlugin(userId) : null

  // 如果开启了持久化，尝试从 localStorage 恢复历史数据
  if (persistencePlugin) {
    const savedData = persistencePlugin.load()
    if (savedData) {
      behaviorStore.import(savedData)
    }
  }

  return {
    /**
     * 根据当前已选筛选器推荐下一步
     */
    recommend(context: string[]): Suggestion[] {
      try {
        if (!Array.isArray(context)) {
          return []
        }
        return recommender.recommend(context)
      } catch {
        return []
      }
    },

    /**
     * 记录一次筛选行为
     * 若开启 persist，每次 record 后写入 localStorage
     */
    record(action: FilterAction): void {
      try {
        if (!action || !Array.isArray(action.sequence)) {
          return
        }
        behaviorStore.record(action.sequence)

        // 行为闭环：若开启持久化，每次 record 后写入 localStorage
        if (persistencePlugin) {
          persistencePlugin.save(behaviorStore.export())
        }
      } catch {
        // 不抛异常到调用方
      }
    },

    /**
     * 导出当前行为数据
     */
    export(): unknown {
      try {
        return behaviorStore.export()
      } catch {
        return { transitions: {}, frequency: {} }
      }
    },
  }
}

// 导出类型供外部使用
export type { FilterDef, FilterDefs } from './types/Filter'
export type { FilterAction } from './types/Behavior'
export type { Suggestion } from './types/Suggestion'
