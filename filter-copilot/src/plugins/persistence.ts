/**
 * localStorage 持久化插件
 *
 * 职责：
 * - 基于 localStorage 的数据持久化
 * - 不侵入核心逻辑
 * - 封装 load / save / clear
 * - 实现 StorageAdapter 接口（同步操作 Promise 包装）
 */

import type { StorageAdapter } from '../types/Storage'
import { getStorageKey, readStorage, writeStorage, removeStorage } from '../utils/storage'

/**
 * 同步版本接口（向后兼容）
 */
export interface PersistencePlugin {
  load(): unknown | null
  save(data: unknown): void
  clear(): void
}

/**
 * 创建同步 localStorage 持久化插件（向后兼容）
 */
export function createPersistencePlugin(userId: string): PersistencePlugin {
  const storageKey = getStorageKey(userId)

  return {
    load(): unknown | null {
      return readStorage(storageKey)
    },

    save(data: unknown): void {
      writeStorage(storageKey, data)
    },

    clear(): void {
      removeStorage(storageKey)
    },
  }
}

/**
 * 创建 localStorage StorageAdapter（异步接口，兼容统一存储抽象）
 */
export function createLocalStorageAdapter(userId: string): StorageAdapter {
  const storageKey = getStorageKey(userId)

  return {
    async load(): Promise<unknown | null> {
      return readStorage(storageKey)
    },

    async save(data: unknown): Promise<void> {
      writeStorage(storageKey, data)
    },

    async clear(): Promise<void> {
      removeStorage(storageKey)
    },

    async estimateSize(): Promise<number> {
      try {
        if (typeof localStorage === 'undefined') return 0
        const raw = localStorage.getItem(storageKey)
        return raw ? new Blob([raw]).size : 0
      } catch {
        return 0
      }
    },
  }
}
