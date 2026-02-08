import { describe, it, expect, beforeEach } from 'vitest'
import { BehaviorStore, compoundKey, parseCompoundKey } from '../src/core/BehaviorStore'

describe('BehaviorStore', () => {
  let store: BehaviorStore

  beforeEach(() => {
    store = new BehaviorStore()
  })

  // ──────── compoundKey 工具 ────────

  describe('compoundKey / parseCompoundKey', () => {
    it('应正确编码和解码', () => {
      const ck = compoundKey('category', '电子产品')
      const parsed = parseCompoundKey(ck)
      expect(parsed).toEqual({ key: 'category', value: '电子产品' })
    })

    it('无分隔符时解析返回 null', () => {
      expect(parseCompoundKey('plain-string')).toBeNull()
    })
  })

  // ──────── Key 维度：record ────────

  describe('record（key 维度）', () => {
    it('应正确记录频率和转移', () => {
      store.record(['a', 'b', 'c'])
      expect(store.getFrequency()).toEqual({ a: 1, b: 1, c: 1 })
      expect(store.getTransition('a')).toEqual({ b: 1 })
      expect(store.getTransition('b')).toEqual({ c: 1 })
    })

    it('累加多次记录', () => {
      store.record(['a', 'b'])
      store.record(['a', 'c'])
      expect(store.getFrequency().a).toBe(2)
      expect(store.getTransition('a')).toEqual({ b: 1, c: 1 })
    })

    it('空数组和非法输入不报错', () => {
      store.record([])
      store.record(null as unknown as string[])
      expect(store.size()).toBe(0)
    })
  })

  // ──────── Value 维度：recordSelections ────────

  describe('recordSelections（value 维度）', () => {
    it('应同时更新 key 维度和 value 维度', () => {
      store.recordSelections([
        { key: 'category', value: '电子产品' },
        { key: 'brand', value: 'Apple' },
      ])

      // key 维度
      expect(store.getFrequency()).toEqual({ category: 1, brand: 1 })
      expect(store.getTransition('category')).toEqual({ brand: 1 })

      // value 维度 — 上下文转移
      expect(store.getContextTransition('category', '电子产品')).toEqual({ brand: 1 })

      // value 维度 — 值共现
      expect(store.getValuePairs('category', '电子产品', 'brand')).toEqual({ Apple: 1 })

      // value 维度 — 值频率
      expect(store.getValueFrequency('category')).toEqual({ '电子产品': 1 })
      expect(store.getValueFrequency('brand')).toEqual({ Apple: 1 })
    })

    it('多次记录应累加计数', () => {
      store.recordSelections([
        { key: 'category', value: '电子产品' },
        { key: 'brand', value: 'Apple' },
      ])
      store.recordSelections([
        { key: 'category', value: '电子产品' },
        { key: 'brand', value: 'Samsung' },
      ])
      store.recordSelections([
        { key: 'category', value: '电子产品' },
        { key: 'brand', value: 'Apple' },
      ])

      expect(store.getContextTransition('category', '电子产品')).toEqual({ brand: 3 })
      expect(store.getValuePairs('category', '电子产品', 'brand')).toEqual({ Apple: 2, Samsung: 1 })
      expect(store.getValueFrequency('brand')).toEqual({ Apple: 2, Samsung: 1 })
    })

    it('不同的 category 值应产生不同的上下文', () => {
      store.recordSelections([
        { key: 'category', value: '电子产品' },
        { key: 'brand', value: 'Apple' },
      ])
      store.recordSelections([
        { key: 'category', value: '服装' },
        { key: 'brand', value: 'Nike' },
      ])

      // 电子产品 → brand 共现 Apple
      expect(store.getValuePairs('category', '电子产品', 'brand')).toEqual({ Apple: 1 })
      // 服装 → brand 共现 Nike
      expect(store.getValuePairs('category', '服装', 'brand')).toEqual({ Nike: 1 })
    })

    it('多选值应每个值都记录', () => {
      store.recordSelections([
        { key: 'category', value: '手机' },
        { key: 'feature', value: ['5G', 'NFC'] },
      ])

      expect(store.getValueFrequency('feature')).toEqual({ '5G': 1, NFC: 1 })
      expect(store.getValuePairs('category', '手机', 'feature')).toEqual({ '5G': 1, NFC: 1 })
    })

    it('三个筛选器应记录所有两两组合', () => {
      store.recordSelections([
        { key: 'category', value: '电子产品' },
        { key: 'brand', value: 'Apple' },
        { key: 'price', value: '5000-8000' },
      ])

      // category → brand, category → price
      expect(store.getContextTransition('category', '电子产品')).toEqual({ brand: 1, price: 1 })
      // brand → price
      expect(store.getContextTransition('brand', 'Apple')).toEqual({ price: 1 })
      // 值共现
      expect(store.getValuePairs('category', '电子产品', 'price')).toEqual({ '5000-8000': 1 })
      expect(store.getValuePairs('brand', 'Apple', 'price')).toEqual({ '5000-8000': 1 })
    })

    it('空 selections 不报错', () => {
      store.recordSelections([])
      store.recordSelections(null as unknown as [])
      expect(store.size()).toBe(0)
    })
  })

  // ──────── export / import ────────

  describe('export / import', () => {
    it('导出应包含全部五张表', () => {
      store.recordSelections([
        { key: 'category', value: '手机' },
        { key: 'brand', value: 'Apple' },
      ])
      const data = store.export()
      expect(data.transitions).toBeDefined()
      expect(data.frequency).toBeDefined()
      expect(data.contextTransitions).toBeDefined()
      expect(data.valuePairs).toBeDefined()
      expect(data.valueFrequency).toBeDefined()
    })

    it('导出再导入应还原状态', () => {
      store.recordSelections([
        { key: 'category', value: '电子产品' },
        { key: 'brand', value: 'Apple' },
      ])
      const snapshot = store.export()

      const newStore = new BehaviorStore()
      newStore.import(snapshot)
      expect(newStore.export()).toEqual(snapshot)
    })

    it('向后兼容：导入不含 value 维度的旧数据', () => {
      store.import({
        transitions: { a: { b: 1 } },
        frequency: { a: 1, b: 1 },
        // 没有 contextTransitions / valuePairs / valueFrequency
      })
      expect(store.getFrequency()).toEqual({ a: 1, b: 1 })
      expect(store.getContextTransition('a', 'v')).toEqual({})
    })
  })

  // ──────── clear ────────

  describe('clear', () => {
    it('应清空全部五张表', () => {
      store.recordSelections([{ key: 'a', value: 'v' }, { key: 'b', value: 'w' }])
      store.clear()
      expect(store.size()).toBe(0)
      expect(store.getContextTransition('a', 'v')).toEqual({})
      expect(store.getValueFrequency('a')).toEqual({})
    })
  })
})
