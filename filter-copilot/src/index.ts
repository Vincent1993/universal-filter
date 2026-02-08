/**
 * Filter Copilot SDK
 *
 * 浏览器本地运行的智能筛选器推荐 SDK
 *
 * 对外入口：
 *   createFilterCopilot      — 同步创建（localStorage / 无持久化）
 *   createFilterCopilotAsync — 异步创建（支持 IndexedDB / 远程冷启动数据）
 */

import type { FilterDefs } from './types/Filter'
import type { FilterAction } from './types/Behavior'
import type { Suggestion } from './types/Suggestion'
import type { StorageAdapter, PersistOptions } from './types/Storage'
import type { BehaviorData } from './core/BehaviorStore'

import { BehaviorStore } from './core/BehaviorStore'
import { RuleEngine } from './core/RuleEngine'
import { Recommender, type RecommendOptions } from './core/Recommender'
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
  /**
   * 持久化配置
   * - false: 不持久化（默认）
   * - true: 使用 localStorage
   * - PersistOptions: 精确控制存储后端
   */
  persist?: boolean | PersistOptions
  /**
   * 冷启动种子数据
   *
   * 当用户无任何历史行为数据时，使用此数据作为初始推荐依据。
   * 一旦有真实行为被记录，冷启动数据自动融入（不会被覆盖）。
   *
   * 可以是：
   * - 静态 BehaviorData 对象
   * - 返回 BehaviorData 的异步加载函数（例如从 CDN 拉取全局热力数据）
   */
  coldStart?: BehaviorData | (() => Promise<BehaviorData>)
  /**
   * 自定义 StorageAdapter（高级用法，优先级最高）
   * 传入后忽略 persist 配置
   */
  storageAdapter?: StorageAdapter
}

// ──────────────── Instance ────────────────

export interface FilterCopilotInstance {
  /** 根据当前已选筛选器推荐下一步 */
  recommend(context: string[], options?: RecommendOptions): Suggestion[]
  /** 记录一次筛选行为 */
  record(action: FilterAction): void
  /** 导出当前行为数据 */
  export(): BehaviorData
  /** 导入行为数据（增量合并或覆盖） */
  import(data: unknown, merge?: boolean): void
  /** 重置全部行为数据（同时清除持久化存储） */
  reset(): void
  /** 获取存储大小估算（字节），仅在使用 StorageAdapter 时可用 */
  estimateStorageSize(): Promise<number>
}

// ──────────────── Internal builder ────────────────

function buildInstance(
  filterDefs: FilterDefs,
  behaviorStore: BehaviorStore,
  ruleEngine: RuleEngine,
  recommender: Recommender,
  syncPlugin: { save(d: unknown): void; clear(): void } | null,
  asyncAdapter: StorageAdapter | null,
): FilterCopilotInstance {
  /**
   * 持久化保存（兼容同步和异步）
   */
  function persistSave(): void {
    const data = behaviorStore.export()
    if (syncPlugin) {
      syncPlugin.save(data)
    }
    if (asyncAdapter) {
      // 异步存储 — fire and forget
      asyncAdapter.save(data).catch(() => {})
    }
  }

  return {
    recommend(context: string[], recommendOptions?: RecommendOptions): Suggestion[] {
      try {
        if (!Array.isArray(context)) return []
        return recommender.recommend(context, recommendOptions)
      } catch {
        return []
      }
    },

    record(action: FilterAction): void {
      try {
        if (!action || !Array.isArray(action.sequence)) return
        behaviorStore.record(action.sequence)
        persistSave()
      } catch {
        // 不抛异常到调用方
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
      } catch {
        // 不抛异常到调用方
      }
    },

    reset(): void {
      try {
        behaviorStore.clear()
        if (syncPlugin) syncPlugin.clear()
        if (asyncAdapter) asyncAdapter.clear().catch(() => {})
      } catch {
        // 不抛异常到调用方
      }
    },

    async estimateStorageSize(): Promise<number> {
      try {
        if (asyncAdapter?.estimateSize) {
          return await asyncAdapter.estimateSize()
        }
        return 0
      } catch {
        return 0
      }
    },
  }
}

// ──────────────── Sync API (backward compatible) ────────────────

/**
 * 同步创建 FilterCopilot 实例
 *
 * 支持 localStorage 持久化和静态冷启动数据。
 * 如需 IndexedDB 或异步冷启动，请使用 createFilterCopilotAsync。
 */
export function createFilterCopilot(options: CreateFilterCopilotOptions): FilterCopilotInstance {
  const { userId, filterDefs, userProfile, persist = false, coldStart } = options

  const behaviorStore = new BehaviorStore()
  const ruleEngine = new RuleEngine(filterDefs)

  const userProfilePlugin = userProfile?.preferredFilters
    ? createUserProfilePlugin(userProfile.preferredFilters)
    : undefined

  const recommender = new Recommender(
    filterDefs,
    behaviorStore,
    ruleEngine,
    userProfilePlugin?.getPreferences(),
  )

  // 同步持久化（仅 localStorage）
  const useLocalStorage = persist === true || (typeof persist === 'object' && persist.type === 'localStorage')
  const syncPlugin = useLocalStorage ? createPersistencePlugin(userId) : null

  // 尝试恢复已有数据
  let hasPersistedData = false
  if (syncPlugin) {
    const saved = syncPlugin.load()
    if (saved) {
      behaviorStore.import(saved)
      hasPersistedData = true
    }
  }

  // 冷启动：仅在无持久化数据时注入种子数据
  if (!hasPersistedData && coldStart && typeof coldStart === 'object' && typeof coldStart !== 'function') {
    behaviorStore.import(coldStart)
  }

  return buildInstance(filterDefs, behaviorStore, ruleEngine, recommender, syncPlugin, null)
}

// ──────────────── Async API ────────────────

/**
 * 异步创建 FilterCopilot 实例
 *
 * 支持 IndexedDB / 自定义 StorageAdapter / 异步冷启动数据加载。
 * recommend / record 调用依然是同步的（< 50ms），只有初始化过程是异步的。
 */
export async function createFilterCopilotAsync(
  options: CreateFilterCopilotOptions,
): Promise<FilterCopilotInstance> {
  const { userId, filterDefs, userProfile, persist = false, coldStart, storageAdapter } = options

  const behaviorStore = new BehaviorStore()
  const ruleEngine = new RuleEngine(filterDefs)

  const userProfilePlugin = userProfile?.preferredFilters
    ? createUserProfilePlugin(userProfile.preferredFilters)
    : undefined

  const recommender = new Recommender(
    filterDefs,
    behaviorStore,
    ruleEngine,
    userProfilePlugin?.getPreferences(),
  )

  // 确定存储适配器
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
      // 默认使用 localStorage 同步插件
      syncPlugin = createPersistencePlugin(userId)
    }
  }

  // 从存储恢复数据
  let hasPersistedData = false

  if (adapter) {
    try {
      const saved = await adapter.load()
      if (saved) {
        behaviorStore.import(saved)
        hasPersistedData = true
      }
    } catch {
      // 恢复失败不阻断初始化
    }
  } else if (syncPlugin) {
    const saved = (syncPlugin as ReturnType<typeof createPersistencePlugin>).load()
    if (saved) {
      behaviorStore.import(saved)
      hasPersistedData = true
    }
  }

  // 冷启动
  if (!hasPersistedData && coldStart) {
    try {
      const seedData = typeof coldStart === 'function' ? await coldStart() : coldStart
      if (seedData && typeof seedData === 'object') {
        behaviorStore.import(seedData)
      }
    } catch {
      // 冷启动失败不阻断初始化
    }
  }

  return buildInstance(filterDefs, behaviorStore, ruleEngine, recommender, syncPlugin, adapter)
}

// ──────────────── 导出类型 ────────────────

export type { FilterDef, FilterDefs } from './types/Filter'
export type { FilterAction } from './types/Behavior'
export type { Suggestion } from './types/Suggestion'
export type { RecommendOptions } from './core/Recommender'
export type { BehaviorData } from './core/BehaviorStore'
export type { StorageAdapter, PersistOptions } from './types/Storage'
