/**
 * 存储适配器抽象
 *
 * 统一 localStorage / IndexedDB 等不同存储后端的访问接口。
 * 所有方法返回 Promise 以兼容异步存储（如 IndexedDB）；
 * 同步存储（如 localStorage）实现时可直接包裹 Promise.resolve。
 */

export interface StorageAdapter {
  /** 加载数据，不存在时返回 null */
  load(): Promise<unknown | null>
  /** 保存数据 */
  save(data: unknown): Promise<void>
  /** 清除数据 */
  clear(): Promise<void>
  /** 估算当前存储占用字节数（可选） */
  estimateSize?(): Promise<number>
}

/**
 * 持久化配置
 *
 * - boolean: true 使用 localStorage，false 不持久化
 * - 对象: 精确控制存储后端和策略
 */
export interface PersistOptions {
  /** 存储后端类型 */
  type: 'localStorage' | 'indexedDB'
  /**
   * 最大记录条数上限
   * 超出时自动淘汰最早的行为数据（仅 indexedDB 有效）
   */
  maxRecords?: number
  /**
   * IndexedDB 数据库名称（仅 indexedDB 有效）
   * 默认 'filter-copilot'
   */
  dbName?: string
}
