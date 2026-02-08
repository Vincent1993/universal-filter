/**
 * SDK 工厂函数（内部模块）
 *
 * 从 index.ts 中提取出来，供 React context 直接导入，
 * 避免 context.tsx → index.ts → sortOptions → ... 的循环依赖。
 */

import type { FilterDefs, FilterSelection } from '../types/Filter'
import type { FilterAction } from '../types/Behavior'
import type { Suggestion, ValueSuggestion } from '../types/Suggestion'
import type { StorageAdapter, PersistOptions } from '../types/Storage'
import type { BehaviorData } from './BehaviorStore'
import type { RecommendOptions, RecommendValuesOptions } from './Recommender'

import { BehaviorStore } from './BehaviorStore'
import { RuleEngine } from './RuleEngine'
import { Recommender } from './Recommender'
import { createPersistencePlugin, createLocalStorageAdapter } from '../plugins/persistence'
import { createIDBPersistencePlugin } from '../plugins/idbPersistence'
import { createUserProfilePlugin } from '../plugins/userProfile'

// ──────────── 类型 ────────────

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

export interface FilterCopilotInstance {
  recommend(context: string[] | FilterSelection[], options?: RecommendOptions): Suggestion[]
  recommendValues(
    targetKey: string,
    context: FilterSelection[],
    allValues?: string[],
    options?: RecommendValuesOptions,
  ): ValueSuggestion[]
  record(action: FilterAction): void
  export(): BehaviorData
  import(data: unknown, merge?: boolean): void
  reset(): void
  estimateStorageSize(): Promise<number>
}

// ──────────── 内部构建器 ────────────

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
    recommend(context, opts) {
      try {
        if (!Array.isArray(context)) return []
        return recommender.recommend(context, opts)
      } catch { return [] }
    },
    recommendValues(targetKey, context, allValues, opts) {
      try { return recommender.recommendValues(targetKey, context, allValues, opts) }
      catch { return [] }
    },
    record(action) {
      try {
        if (!action) return
        if (Array.isArray(action.selections) && action.selections.length > 0) {
          behaviorStore.recordSelections(action.selections)
        } else if (Array.isArray(action.sequence)) {
          behaviorStore.record(action.sequence)
        }
        persistSave()
      } catch {}
    },
    export() {
      try { return behaviorStore.export() }
      catch { return { transitions: {}, frequency: {} } }
    },
    import(data, merge = false) {
      try { behaviorStore.import(data, merge); persistSave() } catch {}
    },
    reset() {
      try {
        behaviorStore.clear()
        if (syncPlugin) syncPlugin.clear()
        if (asyncAdapter) asyncAdapter.clear().catch(() => {})
      } catch {}
    },
    async estimateStorageSize() {
      try { if (asyncAdapter?.estimateSize) return await asyncAdapter.estimateSize(); return 0 }
      catch { return 0 }
    },
  }
}

// ──────────── 同步创建 ────────────

export function createFilterCopilot(options: CreateFilterCopilotOptions): FilterCopilotInstance {
  const { userId, filterDefs, userProfile, persist = false, coldStart } = options
  const behaviorStore = new BehaviorStore()
  const ruleEngine = new RuleEngine(filterDefs)
  const userProfilePlugin = userProfile?.preferredFilters
    ? createUserProfilePlugin(userProfile.preferredFilters) : undefined
  const recommender = new Recommender(filterDefs, behaviorStore, ruleEngine, userProfilePlugin?.getPreferences())

  const useLS = persist === true || (typeof persist === 'object' && persist.type === 'localStorage')
  const syncPlugin = useLS ? createPersistencePlugin(userId) : null

  let hasPersistedData = false
  if (syncPlugin) {
    const saved = syncPlugin.load()
    if (saved) { behaviorStore.import(saved); hasPersistedData = true }
  }
  if (!hasPersistedData && coldStart && typeof coldStart === 'object' && typeof coldStart !== 'function') {
    behaviorStore.import(coldStart)
  }
  return buildInstance(behaviorStore, recommender, syncPlugin, null)
}

// ──────────── 异步创建 ────────────

export async function createFilterCopilotAsync(options: CreateFilterCopilotOptions): Promise<FilterCopilotInstance> {
  const { userId, filterDefs, userProfile, persist = false, coldStart, storageAdapter } = options
  const behaviorStore = new BehaviorStore()
  const ruleEngine = new RuleEngine(filterDefs)
  const userProfilePlugin = userProfile?.preferredFilters
    ? createUserProfilePlugin(userProfile.preferredFilters) : undefined
  const recommender = new Recommender(filterDefs, behaviorStore, ruleEngine, userProfilePlugin?.getPreferences())

  let adapter: StorageAdapter | null = storageAdapter ?? null
  let syncPlugin: { save(d: unknown): void; clear(): void } | null = null

  if (!adapter) {
    if (typeof persist === 'object') {
      if (persist.type === 'indexedDB') adapter = createIDBPersistencePlugin(userId, { dbName: persist.dbName })
      else if (persist.type === 'localStorage') adapter = createLocalStorageAdapter(userId)
    } else if (persist === true) {
      syncPlugin = createPersistencePlugin(userId)
    }
  }

  let hasPersistedData = false
  if (adapter) {
    try { const s = await adapter.load(); if (s) { behaviorStore.import(s); hasPersistedData = true } } catch {}
  } else if (syncPlugin) {
    const s = (syncPlugin as ReturnType<typeof createPersistencePlugin>).load()
    if (s) { behaviorStore.import(s); hasPersistedData = true }
  }
  if (!hasPersistedData && coldStart) {
    try {
      const seed = typeof coldStart === 'function' ? await coldStart() : coldStart
      if (seed && typeof seed === 'object') behaviorStore.import(seed)
    } catch {}
  }
  return buildInstance(behaviorStore, recommender, syncPlugin, adapter)
}
