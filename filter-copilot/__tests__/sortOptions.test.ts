import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createFilterCopilot } from '../src/index'
import { sortOptions, mergeSearchResults } from '../src/utils/sortOptions'
import type { FilterDefs } from '../src/types/Filter'
import type { OptionItem } from '../src/types/Option'

const filterDefs: FilterDefs = {
  category: { label: '分类' },
  brand: { label: '品牌' },
  price: { label: '价格' },
}

describe('sortOptions', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('应按推荐分数排序选项', () => {
    const copilot = createFilterCopilot({ userId: 'u1', filterDefs })

    // 训练数据：选手机时经常选 Apple
    copilot.record({ sequence: ['category', 'brand'], selections: [
      { key: 'category', value: '手机' }, { key: 'brand', value: 'Apple' },
    ]})
    copilot.record({ sequence: ['category', 'brand'], selections: [
      { key: 'category', value: '手机' }, { key: 'brand', value: 'Apple' },
    ]})
    copilot.record({ sequence: ['category', 'brand'], selections: [
      { key: 'category', value: '手机' }, { key: 'brand', value: 'Samsung' },
    ]})

    const options: OptionItem[] = [
      { label: '华为', value: 'Huawei' },
      { label: '三星', value: 'Samsung' },
      { label: '苹果', value: 'Apple' },
      { label: '小米', value: 'Xiaomi' },
    ]

    const sorted = sortOptions({
      copilot,
      targetKey: 'brand',
      context: [{ key: 'category', value: '手机' }],
      options,
    })

    // Apple 应排第一（共现最多）
    expect(sorted[0].value).toBe('Apple')
    expect(sorted[0].label).toBe('苹果')
    expect(sorted[0].score).toBeGreaterThan(0)
    expect(sorted[1].value).toBe('Samsung')
    // 所有选项都应保留
    expect(sorted).toHaveLength(4)
  })

  it('无行为数据时保持原始顺序（分数全 0）', () => {
    const copilot = createFilterCopilot({ userId: 'u1', filterDefs })

    const options: OptionItem[] = [
      { label: 'B', value: 'b' },
      { label: 'A', value: 'a' },
      { label: 'C', value: 'c' },
    ]

    const sorted = sortOptions({ copilot, targetKey: 'brand', context: [], options })
    expect(sorted.every((o) => o.score === 0)).toBe(true)
  })

  it('应保留 OptionItem 的 extra 字段', () => {
    const copilot = createFilterCopilot({ userId: 'u1', filterDefs })

    const options: OptionItem<{ icon: string }>[] = [
      { label: 'Apple', value: 'Apple', extra: { icon: '🍎' } },
    ]

    const sorted = sortOptions({ copilot, targetKey: 'brand', context: [], options })
    expect(sorted[0].extra).toEqual({ icon: '🍎' })
  })

  it('应保留 disabled 标记', () => {
    const copilot = createFilterCopilot({ userId: 'u1', filterDefs })

    const options: OptionItem[] = [
      { label: 'A', value: 'a', disabled: true },
      { label: 'B', value: 'b' },
    ]

    const sorted = sortOptions({ copilot, targetKey: 'brand', context: [], options })
    expect(sorted.find((o) => o.value === 'a')!.disabled).toBe(true)
  })

  it('空选项列表返回空数组', () => {
    const copilot = createFilterCopilot({ userId: 'u1', filterDefs })
    expect(sortOptions({ copilot, targetKey: 'brand', context: [], options: [] })).toEqual([])
  })
})

describe('mergeSearchResults', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('应融合搜索排名和推荐分数', () => {
    const copilot = createFilterCopilot({ userId: 'u1', filterDefs })

    // 训练：选手机时 Apple 最受欢迎
    for (let i = 0; i < 5; i++) {
      copilot.record({ sequence: ['category', 'brand'], selections: [
        { key: 'category', value: '手机' }, { key: 'brand', value: 'Apple' },
      ]})
    }

    // 搜索结果（原始排序：Samsung 第一，Apple 第二）
    const searchResults: OptionItem[] = [
      { label: '三星', value: 'Samsung' },
      { label: '苹果', value: 'Apple' },
      { label: '三星 Galaxy', value: 'SamsungGalaxy' },
    ]

    const merged = mergeSearchResults({
      copilot,
      targetKey: 'brand',
      context: [{ key: 'category', value: '手机' }],
      results: searchResults,
      boostFactor: 0.5,
    })

    // Apple 有推荐加成，应被提升
    expect(merged[0].value).toBe('Apple')
    expect(merged).toHaveLength(3)
  })

  it('boostFactor=0 时保持搜索原始排序', () => {
    const copilot = createFilterCopilot({ userId: 'u1', filterDefs })

    copilot.record({ sequence: ['category', 'brand'], selections: [
      { key: 'category', value: '手机' }, { key: 'brand', value: 'c' },
    ]})

    const results: OptionItem[] = [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
      { label: 'C', value: 'c' },
    ]

    const merged = mergeSearchResults({
      copilot,
      targetKey: 'brand',
      context: [{ key: 'category', value: '手机' }],
      results,
      boostFactor: 0,
    })

    // 原始顺序不变
    expect(merged[0].value).toBe('a')
    expect(merged[1].value).toBe('b')
    expect(merged[2].value).toBe('c')
  })

  it('boostFactor=1 时推荐完全主导', () => {
    const copilot = createFilterCopilot({ userId: 'u1', filterDefs })

    for (let i = 0; i < 10; i++) {
      copilot.record({ sequence: ['category', 'brand'], selections: [
        { key: 'category', value: '手机' }, { key: 'brand', value: 'c' },
      ]})
    }

    const results: OptionItem[] = [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
      { label: 'C', value: 'c' },
    ]

    const merged = mergeSearchResults({
      copilot,
      targetKey: 'brand',
      context: [{ key: 'category', value: '手机' }],
      results,
      boostFactor: 1,
    })

    // c 有最高推荐分，应排第一
    expect(merged[0].value).toBe('c')
  })

  it('空结果返回空数组', () => {
    const copilot = createFilterCopilot({ userId: 'u1', filterDefs })
    const result = mergeSearchResults({
      copilot, targetKey: 'brand', context: [], results: [],
    })
    expect(result).toEqual([])
  })
})
