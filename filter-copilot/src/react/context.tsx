/**
 * FilterCopilot React Context + Provider
 *
 * Headless 设计：
 * - 只管理状态，不渲染任何 UI
 * - 通过 Context 向下传递 SDK 实例
 * - 支持同步（createFilterCopilot）和异步（createFilterCopilotAsync）初始化
 */

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { CreateFilterCopilotOptions, FilterCopilotInstance } from '../index'
import { createFilterCopilot, createFilterCopilotAsync } from '../index'

// ──────────── Context Value ────────────

export interface FilterCopilotContextValue {
  /** SDK 实例，未就绪时为 null */
  copilot: FilterCopilotInstance | null
  /** 是否已完成初始化 */
  ready: boolean
  /** 初始化错误（如有） */
  error: Error | null
}

const FilterCopilotContext = createContext<FilterCopilotContextValue | null>(null)
FilterCopilotContext.displayName = 'FilterCopilotContext'

// ──────────── Provider Props ────────────

export interface FilterCopilotProviderProps {
  /** SDK 配置选项 */
  options: CreateFilterCopilotOptions
  /**
   * 是否使用异步初始化
   * 当 persist.type === 'indexedDB' 或 coldStart 是函数时自动为 true
   */
  async?: boolean
  /** 子组件 */
  children: ReactNode
}

// ──────────── Provider ────────────

export function FilterCopilotProvider({
  options,
  async: asyncInit,
  children,
}: FilterCopilotProviderProps) {
  const [state, setState] = useState<FilterCopilotContextValue>({
    copilot: null,
    ready: false,
    error: null,
  })

  // 使用 ref 跟踪 options 标识，避免不必要的重复初始化
  const initRef = useRef(false)
  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    // 防止 StrictMode 下重复初始化
    if (initRef.current) return
    initRef.current = true

    const needsAsync =
      asyncInit === true ||
      (typeof options.persist === 'object' && options.persist.type === 'indexedDB') ||
      typeof options.coldStart === 'function' ||
      options.storageAdapter !== undefined

    if (needsAsync) {
      // 异步初始化
      let cancelled = false

      createFilterCopilotAsync(optionsRef.current)
        .then((instance) => {
          if (!cancelled) {
            setState({ copilot: instance, ready: true, error: null })
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setState({
              copilot: null,
              ready: false,
              error: err instanceof Error ? err : new Error(String(err)),
            })
          }
        })

      return () => {
        cancelled = true
      }
    } else {
      // 同步初始化
      try {
        const instance = createFilterCopilot(optionsRef.current)
        setState({ copilot: instance, ready: true, error: null })
      } catch (err) {
        setState({
          copilot: null,
          ready: false,
          error: err instanceof Error ? err : new Error(String(err)),
        })
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <FilterCopilotContext.Provider value={state}>
      {children}
    </FilterCopilotContext.Provider>
  )
}

// ──────────── useContext hook ────────────

/**
 * 内部使用：获取 Context value
 * 必须在 FilterCopilotProvider 内部使用
 */
export function useFilterCopilotContext(): FilterCopilotContextValue {
  const ctx = useContext(FilterCopilotContext)
  if (ctx === null) {
    throw new Error(
      'useFilterCopilotContext must be used within a <FilterCopilotProvider>. ' +
        'Wrap your component tree with <FilterCopilotProvider options={...}>.',
    )
  }
  return ctx
}
