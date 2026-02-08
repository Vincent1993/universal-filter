import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { renderHook, act } from '@testing-library/react'
import type { FilterDefs } from '../src/types/Filter'
import type { BehaviorData } from '../src/core/BehaviorStore'
import {
  FilterCopilotProvider,
  useFilterCopilot,
  useRecommendations,
  useRecorder,
} from '../src/react/index'
import type { FilterCopilotProviderProps } from '../src/react/index'

// ──────────── 测试数据 ────────────

const filterDefs: FilterDefs = {
  category: { label: '分类' },
  brand: { label: '品牌', dependsOn: ['category'] },
  price: { label: '价格' },
  color: { label: '颜色' },
}

const coldStartData: BehaviorData = {
  transitions: { category: { brand: 10, price: 5 } },
  frequency: { category: 20, brand: 15, price: 10, color: 5 },
}

// ──────────── Helper ────────────

function createWrapper(
  overrides?: Partial<FilterCopilotProviderProps['options']>,
) {
  const options = {
    userId: 'test-user',
    filterDefs,
    ...overrides,
  }
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <FilterCopilotProvider options={options}>
        {children}
      </FilterCopilotProvider>
    )
  }
}

// ──────────── Tests ────────────

describe('React Headless Components', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  // ──────────── useFilterCopilot ────────────

  describe('useFilterCopilot', () => {
    it('同步初始化后应立即就绪', () => {
      const { result } = renderHook(() => useFilterCopilot(), {
        wrapper: createWrapper(),
      })

      expect(result.current.ready).toBe(true)
      expect(result.current.copilot).not.toBeNull()
      expect(result.current.error).toBeNull()
    })

    it('未在 Provider 内使用应抛错', () => {
      expect(() => {
        renderHook(() => useFilterCopilot())
      }).toThrow('useFilterCopilotContext must be used within a <FilterCopilotProvider>')
    })

    it('copilot 实例应包含完整 API', () => {
      const { result } = renderHook(() => useFilterCopilot(), {
        wrapper: createWrapper(),
      })

      const { copilot } = result.current
      expect(copilot).not.toBeNull()
      expect(typeof copilot!.recommend).toBe('function')
      expect(typeof copilot!.record).toBe('function')
      expect(typeof copilot!.export).toBe('function')
      expect(typeof copilot!.import).toBe('function')
      expect(typeof copilot!.reset).toBe('function')
    })
  })

  // ──────────── useRecommendations ────────────

  describe('useRecommendations', () => {
    it('应返回推荐结果', () => {
      const { result } = renderHook(
        () => useRecommendations([]),
        { wrapper: createWrapper({ coldStart: coldStartData }) },
      )

      expect(result.current.ready).toBe(true)
      expect(result.current.suggestions.length).toBeGreaterThan(0)
      // 基于冷启动数据，category 频率最高
      expect(result.current.suggestions[0].key).toBe('category')
    })

    it('context 变化时应重新计算推荐', () => {
      let context: string[] = []

      const { result, rerender } = renderHook(
        () => useRecommendations(context),
        { wrapper: createWrapper({ coldStart: coldStartData }) },
      )

      // 初始：无 context，推荐无依赖的筛选器
      const initialKeys = result.current.suggestions.map((s) => s.key)
      expect(initialKeys).toContain('category')
      expect(initialKeys).not.toContain('brand') // 依赖 category

      // 更新 context
      context = ['category']
      rerender()

      // 选了 category 后，brand 应出现
      const updatedKeys = result.current.suggestions.map((s) => s.key)
      expect(updatedKeys).toContain('brand')
      expect(updatedKeys).not.toContain('category') // 已选
    })

    it('refresh 应触发重新推荐', () => {
      const { result } = renderHook(
        () => {
          const copilot = useFilterCopilot()
          const recommendations = useRecommendations([])
          return { copilot, recommendations }
        },
        { wrapper: createWrapper() },
      )

      // 初始全 0 分
      expect(result.current.recommendations.suggestions.every((s) => s.score === 0)).toBe(true)

      // 记录行为
      act(() => {
        result.current.copilot.copilot!.record({ sequence: ['category', 'price'] })
      })

      // 手动 refresh
      act(() => {
        result.current.recommendations.refresh()
      })

      // 刷新后应有分数变化
      expect(result.current.recommendations.suggestions.some((s) => s.score > 0)).toBe(true)
    })

    it('maxResults 应限制结果数', () => {
      const { result } = renderHook(
        () => useRecommendations([], { maxResults: 2 }),
        { wrapper: createWrapper({ coldStart: coldStartData }) },
      )

      expect(result.current.suggestions.length).toBeLessThanOrEqual(2)
    })
  })

  // ──────────── useRecorder ────────────

  describe('useRecorder', () => {
    it('record 应正确记录行为', () => {
      const { result } = renderHook(
        () => {
          const recorder = useRecorder()
          const copilot = useFilterCopilot()
          return { recorder, copilot }
        },
        { wrapper: createWrapper() },
      )

      act(() => {
        result.current.recorder.record({ sequence: ['category', 'brand'] })
      })

      const data = result.current.copilot.copilot!.export()
      expect(data.frequency.category).toBe(1)
      expect(data.frequency.brand).toBe(1)
    })

    it('reset 应清空行为数据', () => {
      const { result } = renderHook(
        () => {
          const recorder = useRecorder()
          const copilot = useFilterCopilot()
          return { recorder, copilot }
        },
        { wrapper: createWrapper() },
      )

      act(() => {
        result.current.recorder.record({ sequence: ['category'] })
      })

      act(() => {
        result.current.recorder.reset()
      })

      const data = result.current.copilot.copilot!.export()
      expect(Object.keys(data.frequency).length).toBe(0)
    })

    it('exportData 应返回行为快照', () => {
      const { result } = renderHook(() => useRecorder(), {
        wrapper: createWrapper({ coldStart: coldStartData }),
      })

      const data = result.current.exportData()
      expect(data.frequency.category).toBe(20) // 冷启动数据
    })

    it('importData 应导入数据', () => {
      const { result } = renderHook(
        () => {
          const recorder = useRecorder()
          const copilot = useFilterCopilot()
          return { recorder, copilot }
        },
        { wrapper: createWrapper() },
      )

      act(() => {
        result.current.recorder.importData({
          transitions: { a: { b: 5 } },
          frequency: { a: 10, b: 5 },
        })
      })

      const data = result.current.copilot.copilot!.export()
      expect(data.frequency.a).toBe(10)
    })

    it('SDK 未就绪时 record 不应报错', () => {
      // 这个测试验证 ready=false 时的安全性
      const { result } = renderHook(() => useRecorder(), {
        wrapper: createWrapper(),
      })

      // 由于同步初始化，ready 已经是 true
      // 但 record 本身应该安全
      expect(() => {
        act(() => {
          result.current.record({ sequence: ['a'] })
        })
      }).not.toThrow()
    })
  })

  // ──────────── Provider with cold start ────────────

  describe('Provider + 冷启动', () => {
    it('冷启动数据应自动注入推荐', () => {
      const { result } = renderHook(
        () => useRecommendations([]),
        {
          wrapper: createWrapper({ coldStart: coldStartData }),
        },
      )

      expect(result.current.suggestions[0].key).toBe('category')
      expect(result.current.suggestions[0].score).toBeGreaterThan(0)
    })
  })

  // ──────────── Provider with persistence ────────────

  describe('Provider + 持久化', () => {
    it('persist=true 时行为数据应写入 localStorage', () => {
      const { result } = renderHook(
        () => {
          const recorder = useRecorder()
          return recorder
        },
        { wrapper: createWrapper({ persist: true }) },
      )

      act(() => {
        result.current.record({ sequence: ['category', 'brand'] })
      })

      const key = 'filter-copilot:test-user'
      expect(localStorage.getItem(key)).not.toBeNull()
    })
  })

  // ──────────── 完整使用场景 ────────────

  describe('完整使用场景', () => {
    it('模拟用户筛选旅程：推荐 → 选择 → 记录 → 再推荐', () => {
      const { result } = renderHook(
        () => {
          const copilot = useFilterCopilot()
          const step0 = useRecommendations([])
          return { copilot, step0 }
        },
        { wrapper: createWrapper({ coldStart: coldStartData }) },
      )

      // Step 0: 推荐无依赖的筛选器
      expect(result.current.step0.suggestions[0].key).toBe('category')

      // 记录行为
      act(() => {
        result.current.copilot.copilot!.record({
          sequence: ['category', 'brand', 'price'],
        })
      })

      // Step 0 刷新后分数应更高
      act(() => {
        result.current.step0.refresh()
      })

      const afterRecord = result.current.step0.suggestions
      expect(afterRecord[0].score).toBeGreaterThan(0)
    })
  })
})
