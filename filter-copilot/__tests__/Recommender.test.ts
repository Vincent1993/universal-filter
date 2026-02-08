import { describe, it, expect, beforeEach } from 'vitest'
import { BehaviorStore } from '../src/core/BehaviorStore'
import { RuleEngine } from '../src/core/RuleEngine'
import { Recommender } from '../src/core/Recommender'
import type { FilterDefs } from '../src/types/Filter'

const defs: FilterDefs = {
  category: { label: '分类' },
  brand: { label: '品牌', dependsOn: ['category'] },
  model: { label: '型号', dependsOn: ['category', 'brand'] },
  color: { label: '颜色' },
  price: { label: '价格' },
}

describe('Recommender', () => {
  let store: BehaviorStore
  let ruleEngine: RuleEngine
  let recommender: Recommender

  beforeEach(() => {
    store = new BehaviorStore()
    ruleEngine = new RuleEngine(defs)
    recommender = new Recommender(defs, store, ruleEngine)
  })

  // ──────────── 基本推荐 ────────────

  describe('基本推荐逻辑', () => {
    it('无历史数据时应返回所有可用筛选器，分数均为 0', () => {
      const result = recommender.recommend([])
      expect(result.length).toBeGreaterThan(0)
      // 没有行为数据，所有分数为 0
      result.forEach((s) => expect(s.score).toBe(0))
    })

    it('应排除已选的筛选器', () => {
      const result = recommender.recommend(['category', 'color'])
      const keys = result.map((s) => s.key)
      expect(keys).not.toContain('category')
      expect(keys).not.toContain('color')
    })

    it('应通过规则过滤不满足依赖的筛选器', () => {
      // 空 context：brand 和 model 依赖 category，不应出现
      const result = recommender.recommend([])
      const keys = result.map((s) => s.key)
      expect(keys).not.toContain('brand')
      expect(keys).not.toContain('model')
      expect(keys).toContain('category')
      expect(keys).toContain('color')
      expect(keys).toContain('price')
    })

    it('选择 category 后应解锁 brand', () => {
      const result = recommender.recommend(['category'])
      const keys = result.map((s) => s.key)
      expect(keys).toContain('brand')
      expect(keys).not.toContain('model') // 还需要 brand
    })

    it('全部选完后返回空数组', () => {
      const all = Object.keys(defs)
      expect(recommender.recommend(all)).toEqual([])
    })
  })

  // ──────────── 分数计算 ────────────

  describe('分数计算', () => {
    it('顺序推荐权重应为 ×3', () => {
      // 记录 category → brand 转移
      store.record(['category', 'brand'])

      const result = recommender.recommend(['category'])
      const brandSuggestion = result.find((s) => s.key === 'brand')
      expect(brandSuggestion).toBeDefined()
      // brand 的 transition score = (1/1)*3 = 3, frequency score = (1/1)*1 = 1 → total = 4
      expect(brandSuggestion!.score).toBe(4)
      expect(brandSuggestion!.reason).toContain('sequence')
      expect(brandSuggestion!.reason).toContain('frequency')
    })

    it('全局频率权重应为 ×1', () => {
      // 记录使用频率但不产生与当前 context 相关的转移
      store.record(['color'])
      store.record(['color'])
      store.record(['price'])

      const result = recommender.recommend([])
      const colorSuggestion = result.find((s) => s.key === 'color')
      const priceSuggestion = result.find((s) => s.key === 'price')

      expect(colorSuggestion).toBeDefined()
      expect(priceSuggestion).toBeDefined()
      // color: freq = 2/2 * 1 = 1
      expect(colorSuggestion!.score).toBe(1)
      // price: freq = 1/2 * 1 = 0.5
      expect(priceSuggestion!.score).toBe(0.5)
    })

    it('高频率 + 高转移概率的筛选器分数最高', () => {
      store.record(['category', 'brand'])
      store.record(['category', 'brand'])
      store.record(['category', 'color'])
      store.record(['category', 'price'])

      const result = recommender.recommend(['category'])
      // brand 有最高转移和最高频率
      expect(result[0].key).toBe('brand')
    })

    it('结果应按分数降序排列', () => {
      store.record(['category', 'brand'])
      store.record(['category', 'brand'])
      store.record(['category', 'color'])

      const result = recommender.recommend(['category'])
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score)
      }
    })

    it('同分时应按 key 字典序排列（稳定排序）', () => {
      // 不产生任何行为数据，所有分数都是 0
      const result = recommender.recommend([])
      const keys = result.map((s) => s.key)
      // 应按字母序：category, color, price
      expect(keys).toEqual(['category', 'color', 'price'])
    })
  })

  // ──────────── filterDef.weight ────────────

  describe('filterDef.weight 加成', () => {
    it('weight 应作为乘数影响分数', () => {
      const weightedDefs: FilterDefs = {
        a: { label: 'A', weight: 2 },
        b: { label: 'B', weight: 0.5 },
      }
      const engine = new RuleEngine(weightedDefs)
      const rec = new Recommender(weightedDefs, store, engine)

      store.record(['a'])
      store.record(['b'])

      const result = rec.recommend([])
      const a = result.find((s) => s.key === 'a')!
      const b = result.find((s) => s.key === 'b')!
      // a: freq = 1/1 * 1 * weight(2) = 2
      // b: freq = 1/1 * 1 * weight(0.5) = 0.5
      expect(a.score).toBe(2)
      expect(b.score).toBe(0.5)
    })
  })

  // ──────────── 用户偏好 ────────────

  describe('用户偏好', () => {
    it('偏好权重应作为乘数影响排序', () => {
      const rec = new Recommender(defs, store, ruleEngine, {
        price: 5,
        color: 0.1,
      })

      store.record(['price'])
      store.record(['color'])

      const result = rec.recommend([])
      const price = result.find((s) => s.key === 'price')!
      const color = result.find((s) => s.key === 'color')!

      // price: freq = 1/1 * 1 * pref(5) = 5
      // color: freq = 1/1 * 1 * pref(0.1) = 0.1
      expect(price.score).toBe(5)
      expect(color.score).toBe(0.1)
      expect(price.reason).toContain('preference')
    })

    it('setUserPreferences 应动态更新偏好', () => {
      store.record(['price'])
      store.record(['color'])

      const result1 = recommender.recommend([])
      // 无偏好，分数相同
      expect(result1.find((s) => s.key === 'price')!.score).toBe(
        result1.find((s) => s.key === 'color')!.score,
      )

      recommender.setUserPreferences({ price: 10 })
      const result2 = recommender.recommend([])
      expect(result2.find((s) => s.key === 'price')!.score).toBe(10)
    })
  })

  // ──────────── maxResults ────────────

  describe('maxResults', () => {
    it('应限制返回结果数', () => {
      const result = recommender.recommend([], { maxResults: 2 })
      expect(result.length).toBeLessThanOrEqual(2)
    })

    it('maxResults 大于候选数时返回全部', () => {
      const result = recommender.recommend([], { maxResults: 100 })
      // 空 context 下可用的：category, color, price
      expect(result.length).toBe(3)
    })

    it('maxResults 为 0 或负数不截断', () => {
      const result = recommender.recommend([], { maxResults: 0 })
      expect(result.length).toBe(3)
    })
  })

  // ──────────── reason 字段 ────────────

  describe('reason 字段', () => {
    it('无行为数据时 reason 应为 undefined', () => {
      const result = recommender.recommend([])
      result.forEach((s) => expect(s.reason).toBeUndefined())
    })

    it('只有频率信号时 reason 应包含 frequency', () => {
      store.record(['color'])
      const result = recommender.recommend([])
      const color = result.find((s) => s.key === 'color')!
      expect(color.reason).toBe('frequency')
    })

    it('有转移信号时 reason 应包含 sequence', () => {
      store.record(['category', 'brand'])
      const result = recommender.recommend(['category'])
      const brand = result.find((s) => s.key === 'brand')!
      expect(brand.reason).toContain('sequence')
    })
  })

  // ──────────── 边界情况 ────────────

  describe('边界情况', () => {
    it('非数组 context 返回空数组', () => {
      expect(recommender.recommend(null as unknown as string[])).toEqual([])
      expect(recommender.recommend(undefined as unknown as string[])).toEqual([])
      expect(recommender.recommend('category' as unknown as string[])).toEqual([])
    })

    it('label 应从 filterDefs 正确映射', () => {
      const result = recommender.recommend([])
      const category = result.find((s) => s.key === 'category')!
      expect(category.label).toBe('分类')
    })
  })
})
