import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { renderHook, act } from '@testing-library/react'
import type { FilterDefs } from '../src/types/Filter'
import type { BehaviorData } from '../src/core/BehaviorStore'
import type { OptionItem } from '../src/types/Option'
import { FilterCopilotProvider } from '../src/react/context'
import { useFilterCopilot } from '../src/react/useFilterCopilot'
import { useSortedOptions } from '../src/react/useSortedOptions'
import { useFilterOptions } from '../src/react/useFilterOptions'

const filterDefs: FilterDefs = {
  category: { label: '分类' },
  brand: { label: '品牌' },
  price: { label: '价格' },
}

const coldStart: BehaviorData = {
  transitions: { category: { brand: 10 } },
  frequency: { category: 20, brand: 15 },
  valueFrequency: { brand: { Apple: 10, Samsung: 5, Huawei: 2 } },
  contextTransitions: {},
  valuePairs: {},
}

function createWrapper(overrides?: Partial<{ coldStart: BehaviorData }>) {
  const options = { userId: 'test', filterDefs, ...overrides }
  return ({ children }: { children: React.ReactNode }) => (
    <FilterCopilotProvider options={options}>{children}</FilterCopilotProvider>
  )
}

// 等待条件成立的简单轮询工具
function waitUntil(fn: () => boolean, ms = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      if (fn()) return resolve()
      if (Date.now() - start > ms) return reject(new Error('waitUntil timeout'))
      setTimeout(check, 10)
    }
    check()
  })
}

describe('useSortedOptions', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('应按推荐分排序外部传入的选项', () => {
    const options: OptionItem[] = [
      { label: '华为', value: 'Huawei' },
      { label: '三星', value: 'Samsung' },
      { label: '苹果', value: 'Apple' },
    ]

    const { result } = renderHook(
      () => useSortedOptions('brand', [], options),
      { wrapper: createWrapper({ coldStart }) },
    )

    expect(result.current.ready).toBe(true)
    expect(result.current.sortedOptions[0].value).toBe('Apple')
    expect(result.current.sortedOptions[0].score).toBeGreaterThan(0)
    expect(result.current.sortedOptions[0].label).toBe('苹果')
  })

  it('refresh 后应重新评分', () => {
    const options: OptionItem[] = [
      { label: 'A', value: 'Apple' },
      { label: 'S', value: 'Samsung' },
    ]

    const { result } = renderHook(
      () => {
        const copilot = useFilterCopilot()
        const sorted = useSortedOptions('brand', [], options)
        return { copilot, sorted }
      },
      { wrapper: createWrapper() },
    )

    expect(result.current.sorted.sortedOptions.every((o) => o.score === 0)).toBe(true)

    act(() => {
      result.current.copilot.copilot!.record({
        sequence: ['category', 'brand'],
        selections: [{ key: 'category', value: '手机' }, { key: 'brand', value: 'Apple' }],
      })
    })

    act(() => { result.current.sorted.refresh() })
    expect(result.current.sorted.sortedOptions[0].value).toBe('Apple')
    expect(result.current.sorted.sortedOptions[0].score).toBeGreaterThan(0)
  })
})

describe('useFilterOptions', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('enum 型应直接可用且排序', () => {
    const { result } = renderHook(
      () => useFilterOptions('brand', [], {
        type: 'enum',
        options: [
          { label: '华为', value: 'Huawei' },
          { label: '苹果', value: 'Apple' },
          { label: '三星', value: 'Samsung' },
        ],
      }),
      { wrapper: createWrapper({ coldStart }) },
    )

    expect(result.current.loading).toBe(false)
    expect(result.current.options.length).toBe(3)
    expect(result.current.options[0].value).toBe('Apple')
  })

  it('async 型应自动加载并排序', async () => {
    let resolve: (v: OptionItem[]) => void
    const mockLoader = vi.fn(() => new Promise<OptionItem[]>((r) => { resolve = r }))

    const { result } = renderHook(
      () => useFilterOptions('brand', [], { type: 'async', loader: mockLoader }),
      { wrapper: createWrapper({ coldStart }) },
    )

    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolve!([{ label: '华为', value: 'Huawei' }, { label: '苹果', value: 'Apple' }])
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.options.length).toBe(2)
    expect(result.current.options[0].value).toBe('Apple')
  })

  it('async 加载失败应设置 error', async () => {
    let reject: (e: Error) => void
    const mockLoader = vi.fn(() => new Promise<OptionItem[]>((_, rej) => { reject = rej }))

    const { result } = renderHook(
      () => useFilterOptions('brand', [], { type: 'async', loader: mockLoader }),
      { wrapper: createWrapper() },
    )

    await act(async () => { reject!(new Error('Network error')) })

    expect(result.current.error).not.toBeNull()
    expect(result.current.error!.message).toBe('Network error')
  })

  it('search 空 query + loadOnEmpty=false 应不加载', () => {
    const mockSearcher = vi.fn()

    const { result } = renderHook(
      () => useFilterOptions('brand', [], {
        type: 'search', searcher: mockSearcher, loadOnEmpty: false,
      }),
      { wrapper: createWrapper() },
    )

    act(() => { result.current.search('') })
    expect(mockSearcher).not.toHaveBeenCalled()
  })

  it('search 型应触发搜索并排序结果', async () => {
    let resolve: (v: OptionItem[]) => void
    const mockSearcher = vi.fn(() => new Promise<OptionItem[]>((r) => { resolve = r }))

    const { result } = renderHook(
      () => useFilterOptions('brand', [], {
        type: 'search', searcher: mockSearcher, debounceMs: 10,
      }),
      { wrapper: createWrapper({ coldStart }) },
    )

    act(() => { result.current.search('app') })
    expect(result.current.query).toBe('app')

    // 等待防抖触发
    await waitUntil(() => mockSearcher.mock.calls.length > 0, 500)

    await act(async () => {
      resolve!([{ label: 'Apple', value: 'Apple' }])
    })

    expect(result.current.options.length).toBe(1)
    expect(result.current.options[0].value).toBe('Apple')
  })
})
