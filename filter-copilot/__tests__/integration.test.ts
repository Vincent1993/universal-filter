import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createFilterCopilot } from '../src/index'
import type { FilterDefs } from '../src/types/Filter'

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
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  // ──────── 向后兼容 ────────

  describe('向后兼容（key-only）', () => {
    it('应返回完整 API 实例', () => {
      const c = createFilterCopilot({ userId: 'u1', filterDefs })
      expect(typeof c.recommend).toBe('function')
      expect(typeof c.recommendValues).toBe('function')
      expect(typeof c.record).toBe('function')
      expect(typeof c.export).toBe('function')
      expect(typeof c.import).toBe('function')
      expect(typeof c.reset).toBe('function')
    })

    it('record({ sequence }) 应只更新 key 维度', () => {
      const c = createFilterCopilot({ userId: 'u1', filterDefs })
      c.record({ sequence: ['category', 'brand'] })
      const data = c.export()
      expect(data.frequency.category).toBe(1)
      expect(data.transitions.category.brand).toBe(1)
      // value 维度应为空
      expect(Object.keys(data.valueFrequency ?? {})).toEqual([])
    })

    it('recommend(string[]) 应保持原有行为', () => {
      const c = createFilterCopilot({ userId: 'u1', filterDefs })
      c.record({ sequence: ['category', 'brand', 'model'] })
      c.record({ sequence: ['category', 'brand', 'model'] })

      const r = c.recommend(['category'])
      expect(r[0].key).toBe('brand')
    })
  })

  // ──────── 双维度推荐 ────────

  describe('双维度推荐', () => {
    it('record({ selections }) 应同时更新 key 和 value 维度', () => {
      const c = createFilterCopilot({ userId: 'u1', filterDefs })
      c.record({
        sequence: ['category', 'brand'],
        selections: [
          { key: 'category', value: '手机' },
          { key: 'brand', value: 'Apple' },
        ],
      })

      const data = c.export()
      expect(data.frequency.category).toBe(1)
      expect(data.valueFrequency?.brand).toEqual({ Apple: 1 })
    })

    it('recommend(FilterSelection[]) 应利用值上下文', () => {
      const c = createFilterCopilot({ userId: 'u1', filterDefs })

      // 选电子产品经常选 brand，选服装经常选 color
      for (let i = 0; i < 5; i++) {
        c.record({
          sequence: ['category', 'brand'],
          selections: [
            { key: 'category', value: '电子产品' },
            { key: 'brand', value: 'Apple' },
          ],
        })
        c.record({
          sequence: ['category', 'color'],
          selections: [
            { key: 'category', value: '服装' },
            { key: 'color', value: '红色' },
          ],
        })
      }

      // 传值上下文：电子产品 → brand 优先
      const r1 = c.recommend([{ key: 'category', value: '电子产品' }])
      expect(r1[0].key).toBe('brand')

      // 传值上下文：服装 → color 优先
      const r2 = c.recommend([{ key: 'category', value: '服装' }])
      expect(r2[0].key).toBe('color')

      // 传 key-only：brand 和 color 同频率，按字典序
      const r3 = c.recommend(['category'])
      // brand 有更多 Markov 转移（brand 5次 + color 5次，但都从 category 转移）
      // 实际两者转移次数相同，应按字母序
      expect(r3.find(s => s.key === 'brand')!.score)
        .toBe(r3.find(s => s.key === 'color')!.score)
    })

    it('recommendValues 应排序下拉列表选项', () => {
      const c = createFilterCopilot({ userId: 'u1', filterDefs })

      // 选手机的人经常选 Apple
      c.record({ sequence: ['category', 'brand'], selections: [
        { key: 'category', value: '手机' }, { key: 'brand', value: 'Apple' },
      ]})
      c.record({ sequence: ['category', 'brand'], selections: [
        { key: 'category', value: '手机' }, { key: 'brand', value: 'Apple' },
      ]})
      c.record({ sequence: ['category', 'brand'], selections: [
        { key: 'category', value: '手机' }, { key: 'brand', value: 'Samsung' },
      ]})

      const brandOptions = ['Samsung', 'Apple', 'Huawei', 'Xiaomi']
      const r = c.recommendValues(
        'brand',
        [{ key: 'category', value: '手机' }],
        brandOptions,
      )

      // Apple 应排第一（共现 2 次）
      expect(r[0].value).toBe('Apple')
      expect(r[1].value).toBe('Samsung')
      // 所有选项都应在结果中
      expect(r.map((v) => v.value)).toEqual(
        expect.arrayContaining(['Apple', 'Samsung', 'Huawei', 'Xiaomi']),
      )
    })
  })

  // ──────── 持久化 + value 维度 ────────

  describe('持久化兼容', () => {
    it('value 维度数据应持久化', () => {
      const c1 = createFilterCopilot({ userId: 'persist', filterDefs, persist: true })
      c1.record({ sequence: ['category', 'brand'], selections: [
        { key: 'category', value: '手机' }, { key: 'brand', value: 'Apple' },
      ]})

      const c2 = createFilterCopilot({ userId: 'persist', filterDefs, persist: true })
      const r = c2.recommendValues('brand', [{ key: 'category', value: '手机' }])
      expect(r[0].value).toBe('Apple')
      expect(r[0].score).toBeGreaterThan(0)
    })
  })

  // ──────── 真实场景 ────────

  describe('真实场景：电商筛选旅程', () => {
    it('完整的值感知推荐旅程', () => {
      const c = createFilterCopilot({ userId: 'shopper', filterDefs })

      // 训练数据
      const histories = [
        [{ key: 'category', value: '手机' }, { key: 'brand', value: 'Apple' }, { key: 'price', value: '5000-8000' }],
        [{ key: 'category', value: '手机' }, { key: 'brand', value: 'Apple' }, { key: 'price', value: '8000-12000' }],
        [{ key: 'category', value: '手机' }, { key: 'brand', value: 'Samsung' }, { key: 'price', value: '3000-5000' }],
        [{ key: 'category', value: '电脑' }, { key: 'brand', value: 'Dell' }, { key: 'price', value: '5000-8000' }],
        [{ key: 'category', value: '电脑' }, { key: 'brand', value: 'Lenovo' }, { key: 'color', value: '银色' }],
      ]

      histories.forEach((sels) => {
        c.record({ sequence: sels.map((s) => s.key), selections: sels })
      })

      // 选了手机 → 推荐 brand 优先（3/3 路径都选 brand）
      const step1 = c.recommend([{ key: 'category', value: '手机' }])
      expect(step1[0].key).toBe('brand')

      // 展开 brand 下拉列表 → Apple 应排第一（2/3）
      const brandValues = c.recommendValues(
        'brand',
        [{ key: 'category', value: '手机' }],
        ['Apple', 'Samsung', 'Dell', 'Lenovo', 'Huawei'],
      )
      expect(brandValues[0].value).toBe('Apple')

      // 如果是电脑 → brand 下拉列表中 Dell 和 Lenovo 应排前面
      const pcBrands = c.recommendValues(
        'brand',
        [{ key: 'category', value: '电脑' }],
        ['Apple', 'Samsung', 'Dell', 'Lenovo', 'Huawei'],
      )
      expect(['Dell', 'Lenovo']).toContain(pcBrands[0].value)

      // 选了手机+Apple → price 下拉列表中高价应排前面
      const priceValues = c.recommendValues(
        'price',
        [{ key: 'category', value: '手机' }, { key: 'brand', value: 'Apple' }],
        ['1000-3000', '3000-5000', '5000-8000', '8000-12000'],
      )
      expect(['5000-8000', '8000-12000']).toContain(priceValues[0].value)
    })
  })

  // ──────── 异常安全 ────────

  describe('异常安全', () => {
    it('非法 context 不抛异常', () => {
      const c = createFilterCopilot({ userId: 'u1', filterDefs })
      expect(c.recommend(null as unknown as string[])).toEqual([])
      // null context 被安全处理为 []，allValues 中的值仍返回（分数 0）
      const r = c.recommendValues('brand', null as unknown as [], ['a'])
      expect(r.length).toBe(1)
      expect(r[0].score).toBe(0)
    })

    it('非法 action 不抛异常', () => {
      const c = createFilterCopilot({ userId: 'u1', filterDefs })
      expect(() => c.record(null as unknown as { sequence: string[] })).not.toThrow()
      expect(() => c.record({ sequence: null as unknown as string[] })).not.toThrow()
    })
  })

  // ──────── 性能 ────────

  describe('性能', () => {
    it('recommend < 50ms', () => {
      const c = createFilterCopilot({ userId: 'u1', filterDefs })
      for (let i = 0; i < 100; i++) {
        c.record({ sequence: ['category', 'brand', 'model', 'price', 'color'],
          selections: [
            { key: 'category', value: '电子产品' }, { key: 'brand', value: 'Apple' },
            { key: 'model', value: 'iPhone' }, { key: 'price', value: '5000' },
            { key: 'color', value: '白' },
          ],
        })
      }

      const start = performance.now()
      c.recommend([{ key: 'category', value: '电子产品' }])
      expect(performance.now() - start).toBeLessThan(50)
    })

    it('recommendValues < 50ms', () => {
      const c = createFilterCopilot({ userId: 'u1', filterDefs })
      for (let i = 0; i < 100; i++) {
        c.record({ sequence: ['category', 'brand'],
          selections: [
            { key: 'category', value: '电子产品' },
            { key: 'brand', value: `brand_${i % 20}` },
          ],
        })
      }

      const allValues = Array.from({ length: 50 }, (_, i) => `brand_${i}`)
      const start = performance.now()
      c.recommendValues('brand', [{ key: 'category', value: '电子产品' }], allValues)
      expect(performance.now() - start).toBeLessThan(50)
    })
  })
})
