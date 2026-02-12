/**
 * IndexedDB 持久化插件
 *
 * 职责：
 * - 基于 IndexedDB 的异步数据持久化
 * - 适用于大规模行为数据场景（无 localStorage 5MB 容量限制）
 * - 实现 StorageAdapter 接口
 *
 * 设计要点：
 * - 所有操作异步，不阻塞推荐流程
 * - 内部维护 DB 连接，支持懒初始化
 * - 支持存储大小估算
 */

import type { StorageAdapter } from '../types/Storage'
import { openDB, idbRead, idbWrite, idbRemove, idbEstimateSize, isIDBSupported, closeDB } from '../utils/idb'

export interface IDBPersistenceOptions {
  /** 数据库名称，默认 'filter-copilot' */
  dbName?: string
}

export function createIDBPersistencePlugin(
  userId: string,
  options?: IDBPersistenceOptions,
): StorageAdapter {
  const dbName = options?.dbName ?? 'filter-copilot'
  let db: IDBDatabase | null = null
  let initPromise: Promise<IDBDatabase | null> | null = null

  /**
   * 懒初始化 DB 连接（只打开一次）
   */
  function getDB(): Promise<IDBDatabase | null> {
    if (db) return Promise.resolve(db)
    if (initPromise) return initPromise

    initPromise = (async () => {
      try {
        if (!isIDBSupported()) {
          return null
        }
        db = await openDB(dbName)
        return db
      } catch {
        return null
      }
    })()

    return initPromise
  }

  return {
    async load(): Promise<unknown | null> {
      try {
        const conn = await getDB()
        if (!conn) return null
        return await idbRead(conn, userId)
      } catch {
        return null
      }
    },

    async save(data: unknown): Promise<void> {
      try {
        const conn = await getDB()
        if (!conn) return
        await idbWrite(conn, userId, data)
      } catch {
        // 静默失败
      }
    },

    async clear(): Promise<void> {
      try {
        const conn = await getDB()
        if (!conn) return
        await idbRemove(conn, userId)
      } catch {
        // 静默失败
      }
    },

    async estimateSize(): Promise<number> {
      try {
        const conn = await getDB()
        if (!conn) return 0
        return await idbEstimateSize(conn, userId)
      } catch {
        return 0
      }
    },
  }
}
