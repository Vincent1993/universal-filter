/**
 * Filter Copilot SDK — 双维度智能推荐
 *
 * 维度 1：recommend()        — 推荐下一步用哪个筛选器
 * 维度 2：recommendValues()  — 推荐筛选器内各值的排序（下拉列表排序）
 *
 * 对外入口：
 *   createFilterCopilot      — 同步创建
 *   createFilterCopilotAsync — 异步创建
 */

import type { FilterDefs, FilterSelection } from './types/Filter'
import type { FilterAction } from './types/Behavior'
import type { Suggestion, ValueSuggestion } from './types/Suggestion'
import type { StorageAdapter, PersistOptions } from './types/Storage'
import type { BehaviorData } from './core/BehaviorStore'

import { BehaviorStore } from './core/BehaviorStore'
import { RuleEngine } from './core/RuleEngine'
import { Recommender, type RecommendOptions, type RecommendValuesOptions } from './core/Recommender'
import { createPersistencePlugin, createLocalStorageAdapter } from './plugins/persistence'
import { createIDBPersistencePlugin } from './plugins/idbPersistence'
import { createUserProfilePlugin } from './plugins/userProfile'

// ──────────────── Options ────────────────

export interface CreateFilterCopilotOptions {
  userId: string
  filterDefs: FilterDefs
  userProfile?: {
    preferredFilters?: Record<string, number>
  }
  persist?: boolean | PersistOptions
  coldStart?: BehaviorData | (() => Promise<BehaviorData>)
  storageAdapter?: StorageAdapter
}

// ──────────────── Instance ────────────────

export interface FilterCopilotInstance {
  /**
   * 维度 1：推荐下一步应使用的筛选器
   *
   * @param context  当前已选筛选器
   *   - string[]          — 仅 key（向后兼容）
   *   - FilterSelection[] — key+value（值感知增强推荐）
   */
  recommend(context: string[] | FilterSelection[], options?: RecommendOptions): Suggestion[]

  /**
   * 维度 2：推荐某个筛选器内各值的排序
   *
   * 典型用途：下拉列表选项重排序，将推荐值置顶
   *
   * @param targetKey   目标筛选器 key
   * @param context     当前已选筛选器（带值）
   * @param allValues   该筛选器的全部可选值
   */
  recommendValues(
    targetKey: string,
    context: FilterSelection[],
    allValues?: string[],
    options?: RecommendValuesOptions,
  ): ValueSuggestion[]

  /** 记录一次筛选行为 */
  record(action: FilterAction): void
  /** 导出行为数据 */
  export(): BehaviorData
  /** 导入行为数据 */
  import(data: unknown, merge?: boolean): void
  /** 重置 */
  reset(): void
  /** 存储大小估算 */
  estimateStorageSize(): Promise<number>
}

// ──────────────── Internal builder ────────────────

function buildInstance(
  behaviorStore: BehaviorStore,
  recommender: Recommender,
  syncPlugin: { save(d: unknown): void; clear(): void } | null,
  asyncAdapter: StorageAdapter | null,
): FilterCopilotInstance {
  function persistSave(): void {
    const data = behaviorStore.export()
    if (syncPlugin) syncPlugin.save(data)
    if (asyncAdapter) asyncAdapter.save(data).catch(() => {})
  }

  return {
    recommend(context: string[] | FilterSelection[], opts?: RecommendOptions): Suggestion[] {
      try {
        if (!Array.isArray(context)) return []
        return recommender.recommend(context, opts)
      } catch {
        return []
      }
    },

    recommendValues(
      targetKey: string,
      context: FilterSelection[],
      allValues?: string[],
      opts?: RecommendValuesOptions,
    ): ValueSuggestion[] {
      try {
        return recommender.recommendValues(targetKey, context, allValues, opts)
      } catch {
        return []
      }
    },

    record(action: FilterAction): void {
      try {
        if (!action) return
        // 如果有带值的 selections，记录双维度数据
        if (Array.isArray(action.selections) && action.selections.length > 0) {
          behaviorStore.recordSelections(action.selections)
        } else if (Array.isArray(action.sequence)) {
          // 仅 key 序列（向后兼容）
          behaviorStore.record(action.sequence)
        }
        persistSave()
      } catch {
        // 不抛异常
      }
    },

    export(): BehaviorData {
      try {
        return behaviorStore.export()
      } catch {
        return { transitions: {}, frequency: {} }
      }
    },

    import(data: unknown, merge = false): void {
      try {
        behaviorStore.import(data, merge)
        persistSave()
      } catch {}
    },

    reset(): void {
      try {
        behaviorStore.clear()
        if (syncPlugin) syncPlugin.clear()
        if (asyncAdapter) asyncAdapter.clear().catch(() => {})
      } catch {}
    },

    async estimateStorageSize(): Promise<number> {
      try {
        if (asyncAdapter?.estimateSize) return await asyncAdapter.estimateSize()
        return 0
      } catch {
        return 0
      }
    },
  }
}

// ──────────────── Sync API ────────────────

export function createFilterCopilot(options: CreateFilterCopilotOptions): FilterCopilotInstance {
  const { userId, filterDefs, userProfile, persist = false, coldStart } = options

  const behaviorStore = new BehaviorStore()
  const ruleEngine = new RuleEngine(filterDefs)
  const userProfilePlugin = userProfile?.preferredFilters
    ? createUserProfilePlugin(userProfile.preferredFilters)
    : undefined
  const recommender = new Recommender(filterDefs, behaviorStore, ruleEngine, userProfilePlugin?.getPreferences())

  const useLocalStorage = persist === true || (typeof persist === 'object' && persist.type === 'localStorage')
  const syncPlugin = useLocalStorage ? createPersistencePlugin(userId) : null

  let hasPersistedData = false
  if (syncPlugin) {
    const saved = syncPlugin.load()
    if (saved) {
      behaviorStore.import(saved)
      hasPersistedData = true
    }
  }

  if (!hasPersistedData && coldStart && typeof coldStart === 'object' && typeof coldStart !== 'function') {
    behaviorStore.import(coldStart)
  }

  return buildInstance(behaviorStore, recommender, syncPlugin, null)
}

// ──────────────── Async API ────────────────

export async function createFilterCopilotAsync(
  options: CreateFilterCopilotOptions,
): Promise<FilterCopilotInstance> {
  const { userId, filterDefs, userProfile, persist = false, coldStart, storageAdapter } = options

  const behaviorStore = new BehaviorStore()
  const ruleEngine = new RuleEngine(filterDefs)
  const userProfilePlugin = userProfile?.preferredFilters
    ? createUserProfilePlugin(userProfile.preferredFilters)
    : undefined
  const recommender = new Recommender(filterDefs, behaviorStore, ruleEngine, userProfilePlugin?.getPreferences())

  let adapter: StorageAdapter | null = storageAdapter ?? null
  let syncPlugin: { save(d: unknown): void; clear(): void } | null = null

  if (!adapter) {
    if (typeof persist === 'object') {
      if (persist.type === 'indexedDB') {
        adapter = createIDBPersistencePlugin(userId, { dbName: persist.dbName })
      } else if (persist.type === 'localStorage') {
        adapter = createLocalStorageAdapter(userId)
      }
    } else if (persist === true) {
      syncPlugin = createPersistencePlugin(userId)
    }
  }

  let hasPersistedData = false
  if (adapter) {
    try {
      const saved = await adapter.load()
      if (saved) { behaviorStore.import(saved); hasPersistedData = true }
    } catch {}
  } else if (syncPlugin) {
    const saved = (syncPlugin as ReturnType<typeof createPersistencePlugin>).load()
    if (saved) { behaviorStore.import(saved); hasPersistedData = true }
  }

  if (!hasPersistedData && coldStart) {
    try {
      const seedData = typeof coldStart === 'function' ? await coldStart() : coldStart
      if (seedData && typeof seedData === 'object') behaviorStore.import(seedData)
    } catch {}
  }

  return buildInstance(behaviorStore, recommender, syncPlugin, adapter)
}

// ──────────────── 导出 ────────────────

export type { FilterDef, FilterDefs, FilterSelection } from './types/Filter'
export type { FilterAction } from './types/Behavior'
export type { Suggestion, ValueSuggestion } from './types/Suggestion'
export type { RecommendOptions, RecommendValuesOptions } from './core/Recommender'
export type { BehaviorData } from './core/BehaviorStore'
export type { StorageAdapter, PersistOptions } from './types/Storage'
