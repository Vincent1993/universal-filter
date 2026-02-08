/**
 * 浏览器 localStorage 封装工具
 * 提供安全的读写操作，不抛异常到调用方
 */

const KEY_PREFIX = 'filter-copilot:'

export function getStorageKey(userId: string): string {
  return `${KEY_PREFIX}${userId}`
}

export function readStorage(key: string): unknown | null {
  try {
    if (typeof localStorage === 'undefined') {
      return null
    }
    const raw = localStorage.getItem(key)
    if (raw === null) {
      return null
    }
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function writeStorage(key: string, data: unknown): void {
  try {
    if (typeof localStorage === 'undefined') {
      return
    }
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    // 静默失败：可能是存储已满或隐私模式
  }
}
