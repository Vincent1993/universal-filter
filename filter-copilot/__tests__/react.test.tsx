import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { renderHook, act } from '@testing-library/react'
import type { FilterDefs } from '../src/types/Filter'
import type { BehaviorData } from '../src/core/BehaviorStore'
import {
  FilterCopilotProvider,
  useFilterCopilot,
  useRecommendations,
  useValueRecommendations,
  useRecorder,
} from '../src/react/index'
import type { FilterCopilotProviderProps } from '../src/react/index'

const filterDefs: FilterDefs = {
  category: { label: '分类' },
  brand: { label: '品牌', dependsOn: ['category'] },
  price: { label: '价格' },
  color: { label: '颜色' },
}

const coldStartData: BehaviorData = {
  transitions: { category: { brand: 10, price: 5 } },
  frequency: { category: 20, brand: 15, price: 10, color: 5 },
  contextTransitions: {},
  valuePairs: {},
  valueFrequency: { brand: { Apple: 10, Samsung: 5 } },
}

function createWrapper(overrides?: Partial<FilterCopilotProviderProps['options']>) {
  const options = { userId: 'test-user', filterDefs, ...overrides }
  return ({ children }: { children: React.ReactNode }) => (
    <FilterCopilotProvider options={options}>{children}</FilterCopilotProvider>
  )
}

describe('React Headless Components', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  describe('useFilterCopilot', () => {
    it('同步初始化后应立即就绪', () => {
      const { result } = renderHook(() => useFilterCopilot(), { wrapper: createWrapper() })
      expect(result.current.ready).toBe(true)
      expect(result.current.copilot).not.toBeNull()
    })

    it('未在 Provider 内使用应抛错', () => {
      expect(() => renderHook(() => useFilterCopilot())).toThrow()
    })
  })

  describe('useRecommendations', () => {
    it('支持 string[] context', () => {
      const { result } = renderHook(
        () => useRecommendations([]),
        { wrapper: createWrapper({ coldStart: coldStartData }) },
      )
      expect(result.current.suggestions.length).toBeGreaterThan(0)
    })

    it('支持 FilterSelection[] context', () => {
      const { result } = renderHook(
        () => useRecommendations([{ key: 'category', value: '电子产品' }]),
        { wrapper: createWrapper({ coldStart: coldStartData }) },
      )
      expect(result.current.ready).toBe(true)
    })
  })

  describe('useValueRecommendations', () => {
    it('应返回值推荐排序', () => {
      const { result } = renderHook(
        () => useValueRecommendations('brand', [], ['Apple', 'Samsung', 'Huawei']),
        { wrapper: createWrapper({ coldStart: coldStartData }) },
      )

      expect(result.current.ready).toBe(true)
      expect(result.current.values.length).toBeGreaterThan(0)
      // 从冷启动数据中，Apple 频率最高
      expect(result.current.values[0].value).toBe('Apple')
    })

    it('refresh 应重新计算', () => {
      const { result } = renderHook(
        () => {
          const copilot = useFilterCopilot()
          const vr = useValueRecommendations('brand', [], ['Apple', 'Samsung'])
          return { copilot, vr }
        },
        { wrapper: createWrapper() },
      )

      // 初始无数据
      expect(result.current.vr.values.every((v) => v.score === 0)).toBe(true)

      // 记录行为
      act(() => {
        result.current.copilot.copilot!.record({
          sequence: ['category', 'brand'],
          selections: [{ key: 'category', value: '手机' }, { key: 'brand', value: 'Apple' }],
        })
      })

      // 刷新
      act(() => { result.current.vr.refresh() })

      expect(result.current.vr.values.find((v) => v.value === 'Apple')!.score).toBeGreaterThan(0)
    })
  })

  describe('useRecorder with selections', () => {
    it('record({ selections }) 应更新 value 维度', () => {
      const { result } = renderHook(
        () => {
          const recorder = useRecorder()
          const copilot = useFilterCopilot()
          return { recorder, copilot }
        },
        { wrapper: createWrapper() },
      )

      act(() => {
        result.current.recorder.record({
          sequence: ['category', 'brand'],
          selections: [
            { key: 'category', value: '电子产品' },
            { key: 'brand', value: 'Apple' },
          ],
        })
      })

      const data = result.current.copilot.copilot!.export()
      expect(data.valueFrequency?.brand).toEqual({ Apple: 1 })
    })
  })

  describe('完整使用场景：值感知推荐', () => {
    it('推荐 + 值排序 + 记录闭环', () => {
      const { result } = renderHook(
        () => {
          const copilot = useFilterCopilot()
          const filterRec = useRecommendations([])
          return { copilot, filterRec }
        },
        { wrapper: createWrapper({ coldStart: coldStartData }) },
      )

      // 初始推荐
      expect(result.current.filterRec.suggestions[0].key).toBe('category')

      // 记录带值行为
      act(() => {
        result.current.copilot.copilot!.record({
          sequence: ['category', 'brand'],
          selections: [
            { key: 'category', value: '手机' },
            { key: 'brand', value: 'Apple' },
          ],
        })
      })

      // 刷新后分数应变化
      act(() => { result.current.filterRec.refresh() })
      expect(result.current.filterRec.suggestions.some((s) => s.score > 0)).toBe(true)
    })
  })
})
