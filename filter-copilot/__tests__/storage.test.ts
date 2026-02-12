import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getStorageKey,
  readStorage,
  writeStorage,
  removeStorage,
} from '../src/utils/storage'

describe('storage utils', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // ──────────── getStorageKey ────────────

  describe('getStorageKey', () => {
    it('应生成带前缀的 key', () => {
      expect(getStorageKey('user1')).toBe('filter-copilot:user1')
    })

    it('不同 userId 应生成不同 key', () => {
      expect(getStorageKey('a')).not.toBe(getStorageKey('b'))
    })

    it('空字符串 userId 应返回带前缀的 key', () => {
      expect(getStorageKey('')).toBe('filter-copilot:')
    })
  })

  // ──────────── writeStorage / readStorage ────────────

  describe('writeStorage & readStorage', () => {
    it('写入后应能正确读取对象', () => {
      writeStorage('test-key', { name: 'hello' })
      expect(readStorage('test-key')).toEqual({ name: 'hello' })
    })

    it('写入后应能正确读取数组', () => {
      writeStorage('arr', [1, 2, 3])
      expect(readStorage('arr')).toEqual([1, 2, 3])
    })

    it('写入后应能正确读取基本类型', () => {
      writeStorage('num', 42)
      writeStorage('str', 'hello')
      writeStorage('bool', true)
      writeStorage('nil', null)

      expect(readStorage('num')).toBe(42)
      expect(readStorage('str')).toBe('hello')
      expect(readStorage('bool')).toBe(true)
      expect(readStorage('nil')).toBeNull()
    })

    it('读取不存在的 key 应返回 null', () => {
      expect(readStorage('nonexistent')).toBeNull()
    })

    it('localStorage 中有非法 JSON 时应返回 null', () => {
      localStorage.setItem('bad', 'not-json{{{')
      expect(readStorage('bad')).toBeNull()
    })

    it('多次写入应覆盖之前的值', () => {
      writeStorage('key', 'first')
      writeStorage('key', 'second')
      expect(readStorage('key')).toBe('second')
    })
  })

  // ──────────── removeStorage ────────────

  describe('removeStorage', () => {
    it('应删除指定 key', () => {
      writeStorage('to-remove', 'data')
      expect(readStorage('to-remove')).toBe('data')

      removeStorage('to-remove')
      expect(readStorage('to-remove')).toBeNull()
    })

    it('删除不存在的 key 不应报错', () => {
      expect(() => removeStorage('nonexistent')).not.toThrow()
    })
  })

  // ──────────── 异常安全 ────────────

  describe('异常安全', () => {
    it('setItem 抛异常时 writeStorage 不应传播异常', () => {
      const original = localStorage.setItem
      localStorage.setItem = () => {
        throw new Error('Storage full')
      }

      expect(() => writeStorage('key', 'value')).not.toThrow()

      localStorage.setItem = original
    })

    it('getItem 抛异常时 readStorage 不应传播异常', () => {
      const original = localStorage.getItem
      localStorage.getItem = () => {
        throw new Error('Access denied')
      }

      expect(readStorage('key')).toBeNull()

      localStorage.getItem = original
    })

    it('removeItem 抛异常时 removeStorage 不应传播异常', () => {
      const original = localStorage.removeItem
      localStorage.removeItem = () => {
        throw new Error('Access denied')
      }

      expect(() => removeStorage('key')).not.toThrow()

      localStorage.removeItem = original
    })
  })
})
