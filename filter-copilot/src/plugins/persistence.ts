/**
 * 持久化插件
 *
 * 职责：
 * - 基于 localStorage 的数据持久化
 * - 不侵入核心逻辑
 * - 封装 load / save / clear
 */

import { getStorageKey, readStorage, writeStorage, removeStorage } from '../utils/storage'

export interface PersistencePlugin {
  load(): unknown | null
  save(data: unknown): void
  clear(): void
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

    /**
     * 清除 localStorage 中的行为数据
     */
    clear(): void {
      removeStorage(storageKey)
    },
  }
}
