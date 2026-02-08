import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createLocalStorageAdapter } from '../src/plugins/persistence'
import { createFilterCopilotAsync } from '../src/index'
import type { FilterDefs } from '../src/types/Filter'
import type { StorageAdapter } from '../src/types/Storage'
import type { BehaviorData } from '../src/core/BehaviorStore'

const filterDefs: FilterDefs = {
  category: { label: '分类' },
  brand: { label: '品牌' },
  price: { label: '价格' },
}

describe('StorageAdapter', () => {
  beforeEach(() => localStorage.clear())

  // ──────────── LocalStorage Adapter ────────────

  describe('createLocalStorageAdapter', () => {
    it('save → load 应正确往返', async () => {
      const adapter = createLocalStorageAdapter('adapter-user')
      const data: BehaviorData = {
        transitions: { a: { b: 1 } },
        frequency: { a: 1, b: 1 },
      }

      await adapter.save(data)
      const loaded = await adapter.load()
      expect(loaded).toEqual(data)
    })

    it('clear 应清空数据', async () => {
      const adapter = createLocalStorageAdapter('adapter-user')
      await adapter.save({ test: true })
      await adapter.clear()
      expect(await adapter.load()).toBeNull()
    })

    it('estimateSize 应返回字节数', async () => {
      const adapter = createLocalStorageAdapter('size-user')
      await adapter.save({ hello: 'world' })
      const size = await adapter.estimateSize!()
      expect(size).toBeGreaterThan(0)
    })

    it('无数据时 estimateSize 返回 0', async () => {
      const adapter = createLocalStorageAdapter('empty-user')
      const size = await adapter.estimateSize!()
      expect(size).toBe(0)
    })
  })

  // ──────────── Custom StorageAdapter ────────────

  describe('自定义 StorageAdapter', () => {
    it('应能注入自定义存储实现', async () => {
      const store = new Map<string, unknown>()

      const customAdapter: StorageAdapter = {
        async load() {
          return store.get('data') ?? null
        },
        async save(data) {
          store.set('data', data)
        },
        async clear() {
          store.delete('data')
        },
      }

      const copilot = await createFilterCopilotAsync({
        userId: 'custom-user',
        filterDefs,
        storageAdapter: customAdapter,
      })

      copilot.record({ sequence: ['category', 'brand'] })

      // 数据应被写入自定义存储
      // 异步写入，等一下
      await new Promise((r) => setTimeout(r, 50))
      expect(store.has('data')).toBe(true)

      const saved = store.get('data') as BehaviorData
      expect(saved.frequency.category).toBe(1)
    })

    it('自定义适配器加载失败不阻断初始化', async () => {
      const brokenAdapter: StorageAdapter = {
        async load() {
          throw new Error('Broken storage')
        },
        async save() {},
        async clear() {},
      }

      const copilot = await createFilterCopilotAsync({
        userId: 'broken-user',
        filterDefs,
        storageAdapter: brokenAdapter,
      })

      // 应正常工作
      const result = copilot.recommend([])
      expect(result.length).toBe(3)
    })
  })

  // ──────────── Async init with localStorage adapter ────────────

  describe('createFilterCopilotAsync + localStorage', () => {
    it('persist.type=localStorage 应通过异步适配器工作', async () => {
      const copilot = await createFilterCopilotAsync({
        userId: 'async-ls',
        filterDefs,
        persist: { type: 'localStorage' },
      })

      copilot.record({ sequence: ['category', 'brand'] })

      // 等待异步写入
      await new Promise((r) => setTimeout(r, 50))

      // 应写入 localStorage
      const key = 'filter-copilot:async-ls'
      expect(localStorage.getItem(key)).not.toBeNull()
    })

    it('异步恢复后推荐应有数据', async () => {
      // 先写入数据
      const copilot1 = await createFilterCopilotAsync({
        userId: 'async-restore',
        filterDefs,
        persist: { type: 'localStorage' },
      })
      copilot1.record({ sequence: ['category', 'brand'] })
      await new Promise((r) => setTimeout(r, 50))

      // 新实例恢复
      const copilot2 = await createFilterCopilotAsync({
        userId: 'async-restore',
        filterDefs,
        persist: { type: 'localStorage' },
      })

      const result = copilot2.recommend(['category'])
      expect(result.some((s) => s.score > 0)).toBe(true)
    })
  })

  // ──────────── estimateStorageSize ────────────

  describe('estimateStorageSize', () => {
    it('使用自定义适配器时应返回估算值', async () => {
      const customAdapter: StorageAdapter = {
        async load() { return null },
        async save() {},
        async clear() {},
        async estimateSize() { return 1024 },
      }

      const copilot = await createFilterCopilotAsync({
        userId: 'size-test',
        filterDefs,
        storageAdapter: customAdapter,
      })

      const size = await copilot.estimateStorageSize()
      expect(size).toBe(1024)
    })

    it('无适配器时返回 0', () => {
      const copilot = createFilterCopilotAsync({
        userId: 'no-adapter',
        filterDefs,
      })

      return copilot.then(async (c) => {
        const size = await c.estimateStorageSize()
        expect(size).toBe(0)
      })
    })
  })
})
