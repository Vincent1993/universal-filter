/**
 * IndexedDB 底层工具
 *
 * 轻量封装，零依赖，所有操作 Promise 化。
 * 使用 object store 的 key-value 模型：每个 userId 对应一条记录。
 *
 * 数据库结构：
 *   Database: <dbName>  (默认 'filter-copilot')
 *   ObjectStore: 'behavior'
 *   Key: userId (string)
 *   Value: BehaviorData
 */

const DEFAULT_DB_NAME = 'filter-copilot'
const STORE_NAME = 'behavior'
const DB_VERSION = 1

/**
 * 检测当前环境是否支持 IndexedDB
 */
export function isIDBSupported(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

/**
 * 打开 / 创建 IndexedDB 数据库
 */
export function openDB(dbName: string = DEFAULT_DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIDBSupported()) {
      reject(new Error('IndexedDB is not supported in this environment'))
      return
    }

    const request = indexedDB.open(dbName, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      reject(request.error)
    }
  })
}

/**
 * 从 IndexedDB 读取数据
 */
export function idbRead(db: IDBDatabase, key: string): Promise<unknown | null> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(key)

      request.onsuccess = () => {
        resolve(request.result ?? null)
      }

      request.onerror = () => {
        reject(request.error)
      }
    } catch (e) {
      reject(e)
    }
  })
}

/**
 * 向 IndexedDB 写入数据
 */
export function idbWrite(db: IDBDatabase, key: string, data: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.put(data, key)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    } catch (e) {
      reject(e)
    }
  })
}

/**
 * 从 IndexedDB 删除数据
 */
export function idbRemove(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.delete(key)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    } catch (e) {
      reject(e)
    }
  })
}

/**
 * 估算某个 key 对应数据的 JSON 序列化大小（字节）
 */
export async function idbEstimateSize(db: IDBDatabase, key: string): Promise<number> {
  const data = await idbRead(db, key)
  if (data === null || data === undefined) {
    return 0
  }
  try {
    return new Blob([JSON.stringify(data)]).size
  } catch {
    return 0
  }
}

/**
 * 关闭数据库连接
 */
export function closeDB(db: IDBDatabase): void {
  try {
    db.close()
  } catch {
    // 静默失败
  }
}
