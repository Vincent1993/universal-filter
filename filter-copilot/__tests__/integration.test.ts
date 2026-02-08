import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createFilterCopilot } from '../src/index'
import type { FilterDefs } from '../src/types/Filter'

/**
 * 电商场景筛选器定义
 */
const filterDefs: FilterDefs = {
  category: { label: '分类' },
  brand: { label: '品牌', dependsOn: ['category'] },
  model: { label: '型号', dependsOn: ['category', 'brand'] },
  price: { label: '价格' },
  color: { label: '颜色' },
  size: { label: '尺寸', dependsOn: ['category'] },
  rating: { label: '评分' },
}

describe('createFilterCopilot - 集成测试', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // ──────────── 基本功能 ────────────

  describe('基本功能', () => {
    it('应返回包含 recommend/record/export/import/reset 的实例', () => {
      const copilot = createFilterCopilot({
        userId: 'u1',
        filterDefs,
      })

      expect(typeof copilot.recommend).toBe('function')
      expect(typeof copilot.record).toBe('function')
      expect(typeof copilot.export).toBe('function')
      expect(typeof copilot.import).toBe('function')
      expect(typeof copilot.reset).toBe('function')
    })

    it('无历史数据时推荐应返回所有可用（无依赖）的筛选器', () => {
      const copilot = createFilterCopilot({ userId: 'u1', filterDefs })
      const suggestions = copilot.recommend([])
      const keys = suggestions.map((s) => s.key)

      expect(keys).toContain('category')
      expect(keys).toContain('price')
      expect(keys).toContain('color')
      expect(keys).toContain('rating')
      // 有依赖的不应出现
      expect(keys).not.toContain('brand')
      expect(keys).not.toContain('model')
      expect(keys).not.toContain('size')
    })
  })

  // ──────────── 行为闭环 ────────────

  describe('行为闭环', () => {
    it('record 之后推荐分数应发生变化', () => {
      const copilot = createFilterCopilot({ userId: 'u1', filterDefs })

      // 初始推荐全为 0 分
      const before = copilot.recommend([])
      expect(before.every((s) => s.score === 0)).toBe(true)

      // 记录行为
      copilot.record({ sequence: ['category', 'brand', 'model'] })

      // 推荐分数应有变化
      const after = copilot.recommend([])
      expect(after.some((s) => s.score > 0)).toBe(true)
    })

    it('多次 record 应累加行为数据', () => {
      const copilot = createFilterCopilot({ userId: 'u1', filterDefs })

      copilot.record({ sequence: ['category', 'brand'] })
      copilot.record({ sequence: ['category', 'brand'] })
      copilot.record({ sequence: ['category', 'price'] })

      const result = copilot.recommend(['category'])
      const brand = result.find((s) => s.key === 'brand')!
      const price = result.find((s) => s.key === 'price')!

      // brand 转移次数多于 price，分数更高
      expect(brand.score).toBeGreaterThan(price.score)
    })

    it('推荐应在链路中逐步引导', () => {
      const copilot = createFilterCopilot({ userId: 'u1', filterDefs })

      // 训练数据：用户经常走 category → brand → model 路径
      for (let i = 0; i < 5; i++) {
        copilot.record({ sequence: ['category', 'brand', 'model'] })
      }

      // 第一步：推荐 category（分数最高的无依赖筛选器）
      const step0 = copilot.recommend([])
      expect(step0[0].key).toBe('category')

      // 第二步：选了 category 后，brand 应排第一
      const step1 = copilot.recommend(['category'])
      expect(step1[0].key).toBe('brand')

      // 第三步：选了 category + brand 后，model 应排第一
      const step2 = copilot.recommend(['category', 'brand'])
      expect(step2[0].key).toBe('model')
    })
  })

  // ──────────── 持久化 ────────────

  describe('持久化', () => {
    it('persist=true 时 record 应写入 localStorage', () => {
      const copilot = createFilterCopilot({
        userId: 'persist-user',
        filterDefs,
        persist: true,
      })

      copilot.record({ sequence: ['category', 'brand'] })

      // localStorage 中应有数据
      const key = 'filter-copilot:persist-user'
      const raw = localStorage.getItem(key)
      expect(raw).not.toBeNull()

      const data = JSON.parse(raw!)
      expect(data.frequency).toBeDefined()
      expect(data.transitions).toBeDefined()
    })

    it('新实例应从 localStorage 恢复历史数据', () => {
      // 第一个实例：记录行为
      const copilot1 = createFilterCopilot({
        userId: 'persist-user',
        filterDefs,
        persist: true,
      })
      copilot1.record({ sequence: ['category', 'brand'] })
      copilot1.record({ sequence: ['category', 'brand'] })

      // 第二个实例：应自动恢复
      const copilot2 = createFilterCopilot({
        userId: 'persist-user',
        filterDefs,
        persist: true,
      })

      const result = copilot2.recommend(['category'])
      const brand = result.find((s) => s.key === 'brand')!
      expect(brand.score).toBeGreaterThan(0)
    })

    it('persist=false 时不应写入 localStorage', () => {
      const copilot = createFilterCopilot({
        userId: 'no-persist-user',
        filterDefs,
        persist: false,
      })

      copilot.record({ sequence: ['category', 'brand'] })

      const key = 'filter-copilot:no-persist-user'
      expect(localStorage.getItem(key)).toBeNull()
    })
  })

  // ──────────── export / import ────────────

  describe('export / import', () => {
    it('export 应返回行为数据快照', () => {
      const copilot = createFilterCopilot({ userId: 'u1', filterDefs })
      copilot.record({ sequence: ['category', 'brand'] })

      const data = copilot.export() as { transitions: Record<string, Record<string, number>>; frequency: Record<string, number> }
      expect(data.frequency.category).toBe(1)
      expect(data.frequency.brand).toBe(1)
      expect(data.transitions.category.brand).toBe(1)
    })

    it('import 应恢复行为数据', () => {
      const copilot = createFilterCopilot({ userId: 'u1', filterDefs })

      copilot.import({
        transitions: { category: { brand: 10 } },
        frequency: { category: 10, brand: 10 },
      })

      const result = copilot.recommend(['category'])
      const brand = result.find((s) => s.key === 'brand')!
      expect(brand.score).toBeGreaterThan(0)
    })

    it('import merge=true 应累加数据', () => {
      const copilot = createFilterCopilot({ userId: 'u1', filterDefs })
      copilot.record({ sequence: ['category', 'brand'] })

      copilot.import(
        { transitions: { category: { brand: 5 } }, frequency: { category: 5, brand: 5 } },
        true,
      )

      const data = copilot.export() as { transitions: Record<string, Record<string, number>>; frequency: Record<string, number> }
      expect(data.frequency.category).toBe(6) // 1 + 5
      expect(data.transitions.category.brand).toBe(6) // 1 + 5
    })

    it('import 后持久化应自动保存', () => {
      const copilot = createFilterCopilot({
        userId: 'import-persist',
        filterDefs,
        persist: true,
      })

      copilot.import({
        transitions: { category: { brand: 3 } },
        frequency: { category: 3, brand: 3 },
      })

      const key = 'filter-copilot:import-persist'
      const raw = localStorage.getItem(key)
      expect(raw).not.toBeNull()
      expect(JSON.parse(raw!).frequency.category).toBe(3)
    })
  })

  // ──────────── reset ────────────

  describe('reset', () => {
    it('应清空所有行为数据', () => {
      const copilot = createFilterCopilot({ userId: 'u1', filterDefs })
      copilot.record({ sequence: ['category', 'brand'] })
      copilot.reset()

      const data = copilot.export() as { transitions: Record<string, Record<string, number>>; frequency: Record<string, number> }
      expect(Object.keys(data.frequency).length).toBe(0)
      expect(Object.keys(data.transitions).length).toBe(0)
    })

    it('reset 后推荐分数应全部归零', () => {
      const copilot = createFilterCopilot({ userId: 'u1', filterDefs })
      copilot.record({ sequence: ['category', 'brand'] })
      copilot.reset()

      const result = copilot.recommend([])
      expect(result.every((s) => s.score === 0)).toBe(true)
    })

    it('persist=true 时 reset 应清除 localStorage', () => {
      const copilot = createFilterCopilot({
        userId: 'reset-persist',
        filterDefs,
        persist: true,
      })

      copilot.record({ sequence: ['category', 'brand'] })
      const key = 'filter-copilot:reset-persist'
      expect(localStorage.getItem(key)).not.toBeNull()

      copilot.reset()
      expect(localStorage.getItem(key)).toBeNull()
    })
  })

  // ──────────── 用户偏好 ────────────

  describe('用户偏好', () => {
    it('偏好应影响推荐排序', () => {
      const copilot = createFilterCopilot({
        userId: 'u1',
        filterDefs,
        userProfile: {
          preferredFilters: { price: 10, color: 0.1 },
        },
      })

      // 记录等频数据
      copilot.record({ sequence: ['price'] })
      copilot.record({ sequence: ['color'] })

      const result = copilot.recommend([])
      const price = result.find((s) => s.key === 'price')!
      const color = result.find((s) => s.key === 'color')!

      expect(price.score).toBeGreaterThan(color.score)
    })
  })

  // ──────────── 异常安全 ────────────

  describe('异常安全', () => {
    it('非法 context 不应抛异常', () => {
      const copilot = createFilterCopilot({ userId: 'u1', filterDefs })
      expect(copilot.recommend(null as unknown as string[])).toEqual([])
      expect(copilot.recommend(undefined as unknown as string[])).toEqual([])
      expect(copilot.recommend(123 as unknown as string[])).toEqual([])
    })

    it('非法 action 不应抛异常', () => {
      const copilot = createFilterCopilot({ userId: 'u1', filterDefs })
      expect(() => copilot.record(null as unknown as { sequence: string[] })).not.toThrow()
      expect(() => copilot.record(undefined as unknown as { sequence: string[] })).not.toThrow()
      expect(() => copilot.record({ sequence: null as unknown as string[] })).not.toThrow()
      expect(() => copilot.record({ sequence: 'bad' as unknown as string[] })).not.toThrow()
    })

    it('非法 import 不应抛异常', () => {
      const copilot = createFilterCopilot({ userId: 'u1', filterDefs })
      expect(() => copilot.import(null)).not.toThrow()
      expect(() => copilot.import(undefined)).not.toThrow()
      expect(() => copilot.import('bad')).not.toThrow()
    })
  })

  // ──────────── maxResults ────────────

  describe('maxResults', () => {
    it('应通过 recommend options 限制返回数', () => {
      const copilot = createFilterCopilot({ userId: 'u1', filterDefs })
      const result = copilot.recommend([], { maxResults: 2 })
      expect(result.length).toBeLessThanOrEqual(2)
    })
  })

  // ──────────── 性能 ────────────

  describe('性能', () => {
    it('单次 recommend 应在 50ms 以内', () => {
      const copilot = createFilterCopilot({ userId: 'u1', filterDefs })

      // 预填充较多行为数据
      for (let i = 0; i < 100; i++) {
        copilot.record({ sequence: ['category', 'brand', 'model', 'price', 'color'] })
      }

      const start = performance.now()
      copilot.recommend(['category'])
      const elapsed = performance.now() - start

      expect(elapsed).toBeLessThan(50)
    })

    it('大量 filterDefs 下推荐仍应在 50ms 以内', () => {
      // 构造 200 个筛选器
      const largeDefs: FilterDefs = {}
      for (let i = 0; i < 200; i++) {
        largeDefs[`filter_${i}`] = { label: `筛选器 ${i}` }
      }

      const copilot = createFilterCopilot({ userId: 'perf', filterDefs: largeDefs })

      // 记录行为
      const seq = Array.from({ length: 50 }, (_, i) => `filter_${i}`)
      for (let i = 0; i < 50; i++) {
        copilot.record({ sequence: seq })
      }

      const start = performance.now()
      copilot.recommend(['filter_0', 'filter_1'])
      const elapsed = performance.now() - start

      expect(elapsed).toBeLessThan(50)
    })
  })

  // ──────────── 真实场景模拟 ────────────

  describe('真实场景模拟 — 电商筛选', () => {
    it('应模拟完整的用户筛选旅程', () => {
      const copilot = createFilterCopilot({
        userId: 'shopper',
        filterDefs,
        persist: true,
      })

      // 模拟多个用户的历史行为
      const histories = [
        ['category', 'brand', 'price', 'color'],
        ['category', 'brand', 'model'],
        ['category', 'brand', 'price'],
        ['category', 'price', 'color'],
        ['category', 'brand', 'price', 'rating'],
      ]

      histories.forEach((seq) => copilot.record({ sequence: seq }))

      // 新用户开始筛选
      // 第 1 步：推荐 category（最常用）
      const step0 = copilot.recommend([])
      expect(step0[0].key).toBe('category')

      // 第 2 步：选了 category，推荐 brand（4/5 路径都先选 brand）
      const step1 = copilot.recommend(['category'])
      expect(step1[0].key).toBe('brand')

      // 第 3 步：选了 brand 后，price 或 model 应出现在推荐中
      const step2 = copilot.recommend(['category', 'brand'])
      const keys2 = step2.map((s) => s.key)
      expect(keys2).toContain('price')
      expect(keys2).toContain('model')

      // 验证数据已持久化
      const raw = localStorage.getItem('filter-copilot:shopper')
      expect(raw).not.toBeNull()

      // 新实例恢复数据，推荐行为一致
      const copilot2 = createFilterCopilot({
        userId: 'shopper',
        filterDefs,
        persist: true,
      })
      const step0Again = copilot2.recommend([])
      expect(step0Again[0].key).toBe(step0[0].key)
      expect(step0Again[0].score).toBe(step0[0].score)
    })
  })
})
