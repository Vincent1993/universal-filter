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
  let engine: RuleEngine
  let rec: Recommender

  beforeEach(() => {
    store = new BehaviorStore()
    engine = new RuleEngine(defs)
    rec = new Recommender(defs, store, engine)
  })

  // ──────── 维度 1：筛选器推荐（key-only，向后兼容）────────

  describe('recommend（string[] context）', () => {
    it('无历史时分数全 0', () => {
      const r = rec.recommend([])
      expect(r.every((s) => s.score === 0)).toBe(true)
    })

    it('排除已选 + 规则过滤', () => {
      const r = rec.recommend(['category'])
      const keys = r.map((s) => s.key)
      expect(keys).not.toContain('category')
      expect(keys).toContain('brand')
      expect(keys).not.toContain('model') // 需要 brand
    })

    it('Markov 转移权重 ×3', () => {
      store.record(['category', 'brand'])
      const r = rec.recommend(['category'])
      const brand = r.find((s) => s.key === 'brand')!
      expect(brand.score).toBe(4) // transition 3 + frequency 1
      expect(brand.reason).toContain('sequence')
    })

    it('稳定排序', () => {
      const r = rec.recommend([])
      const keys = r.map((s) => s.key)
      expect(keys).toEqual(['category', 'color', 'price'])
    })
  })

  // ──────── 维度 1：筛选器推荐（FilterSelection[] context）────────

  describe('recommend（FilterSelection[] context）', () => {
    it('值感知推荐：不同值导致不同推荐排序', () => {
      // 用户选电子产品后经常选 brand
      store.recordSelections([
        { key: 'category', value: '电子产品' },
        { key: 'brand', value: 'Apple' },
      ])
      store.recordSelections([
        { key: 'category', value: '电子产品' },
        { key: 'brand', value: 'Samsung' },
      ])
      // 用户选服装后经常选 color
      store.recordSelections([
        { key: 'category', value: '服装' },
        { key: 'color', value: '红色' },
      ])
      store.recordSelections([
        { key: 'category', value: '服装' },
        { key: 'color', value: '蓝色' },
      ])

      // 传入 category=电子产品 → brand 应排在前面
      const r1 = rec.recommend([{ key: 'category', value: '电子产品' }])
      expect(r1[0].key).toBe('brand')
      expect(r1[0].reason).toContain('context')

      // 传入 category=服装 → color 应排在前面
      const r2 = rec.recommend([{ key: 'category', value: '服装' }])
      expect(r2[0].key).toBe('color')
    })

    it('context 信号应与 Markov 转移信号叠加', () => {
      store.recordSelections([
        { key: 'category', value: '电子产品' },
        { key: 'brand', value: 'Apple' },
      ])
      const r = rec.recommend([{ key: 'category', value: '电子产品' }])
      const brand = r.find((s) => s.key === 'brand')!
      // sequence(3) + context(2) + frequency(1) = 6
      expect(brand.score).toBe(6)
    })
  })

  // ──────── 维度 2：值推荐 ────────

  describe('recommendValues', () => {
    it('应按上下文共现排序值', () => {
      store.recordSelections([
        { key: 'category', value: '电子产品' },
        { key: 'brand', value: 'Apple' },
      ])
      store.recordSelections([
        { key: 'category', value: '电子产品' },
        { key: 'brand', value: 'Apple' },
      ])
      store.recordSelections([
        { key: 'category', value: '电子产品' },
        { key: 'brand', value: 'Samsung' },
      ])

      const r = rec.recommendValues(
        'brand',
        [{ key: 'category', value: '电子产品' }],
        ['Apple', 'Samsung', 'Huawei', 'Xiaomi'],
      )

      // Apple(共现2) > Samsung(共现1) > Huawei/Xiaomi(共现0)
      expect(r[0].value).toBe('Apple')
      expect(r[1].value).toBe('Samsung')
      expect(r[0].score).toBeGreaterThan(r[1].score)
      // Huawei, Xiaomi 分数为 0 但仍在列表中
      expect(r.map((v) => v.value)).toContain('Huawei')
      expect(r.map((v) => v.value)).toContain('Xiaomi')
    })

    it('不同 context 应产生不同的值排序', () => {
      store.recordSelections([
        { key: 'category', value: '电子产品' },
        { key: 'brand', value: 'Apple' },
      ])
      store.recordSelections([
        { key: 'category', value: '服装' },
        { key: 'brand', value: 'Nike' },
      ])

      const brands = ['Apple', 'Nike', 'Samsung']

      const r1 = rec.recommendValues('brand', [{ key: 'category', value: '电子产品' }], brands)
      expect(r1[0].value).toBe('Apple')

      const r2 = rec.recommendValues('brand', [{ key: 'category', value: '服装' }], brands)
      expect(r2[0].value).toBe('Nike')
    })

    it('无上下文时按全局值频率排序', () => {
      store.recordSelections([{ key: 'brand', value: 'Apple' }, { key: 'color', value: '白' }])
      store.recordSelections([{ key: 'brand', value: 'Apple' }, { key: 'color', value: '黑' }])
      store.recordSelections([{ key: 'brand', value: 'Samsung' }, { key: 'color', value: '黑' }])

      const r = rec.recommendValues('brand', [], ['Apple', 'Samsung', 'Huawei'])
      expect(r[0].value).toBe('Apple') // freq 2
      expect(r[1].value).toBe('Samsung') // freq 1
    })

    it('allValues 未提供时只返回有数据的值', () => {
      store.recordSelections([{ key: 'brand', value: 'Apple' }, { key: 'color', value: '白' }])
      const r = rec.recommendValues('brand', [])
      expect(r.length).toBe(1)
      expect(r[0].value).toBe('Apple')
    })

    it('maxResults 应限制返回数', () => {
      store.recordSelections([{ key: 'b', value: 'v1' }, { key: 'c', value: 'x' }])
      store.recordSelections([{ key: 'b', value: 'v2' }, { key: 'c', value: 'x' }])
      store.recordSelections([{ key: 'b', value: 'v3' }, { key: 'c', value: 'x' }])

      const r = rec.recommendValues('b', [], undefined, { maxResults: 2 })
      expect(r.length).toBeLessThanOrEqual(2)
    })

    it('reason 应正确标记信号来源', () => {
      store.recordSelections([
        { key: 'category', value: '电子产品' },
        { key: 'brand', value: 'Apple' },
      ])

      const r = rec.recommendValues('brand', [{ key: 'category', value: '电子产品' }])
      const apple = r.find((v) => v.value === 'Apple')!
      expect(apple.reason).toContain('frequency')
      expect(apple.reason).toContain('context')
    })

    it('非法输入返回空数组', () => {
      expect(rec.recommendValues(null as unknown as string, [])).toEqual([])
    })
  })
})
