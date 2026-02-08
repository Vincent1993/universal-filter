/**
 * 持久化插件
 *
 * 职责：
 * - 基于 localStorage 的数据持久化
 * - 不侵入核心逻辑
 * - 封装 load / save
 */

import { getStorageKey, readStorage, writeStorage } from '../utils/storage'

export interface PersistencePlugin {
  load(): unknown | null
  save(data: unknown): void
}

export function createPersistencePlugin(userId: string): PersistencePlugin {
  const storageKey = getStorageKey(userId)

  return {
    /**
     * 从 localStorage 加载行为数据
     */
    load(): unknown | null {
      return readStorage(storageKey)
    },

    /**
     * 将行为数据保存到 localStorage
     */
    save(data: unknown): void {
      writeStorage(storageKey, data)
    },
  }
}
