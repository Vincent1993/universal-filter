/**
 * FilterCopilot React Context + Provider
 *
 * 直接导入 factory 而非 index.ts，避免循环依赖。
 */

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { CreateFilterCopilotOptions, FilterCopilotInstance } from '../core/factory'
import { createFilterCopilot, createFilterCopilotAsync } from '../core/factory'

// ──────────── Context Value ────────────

export interface FilterCopilotContextValue {
  copilot: FilterCopilotInstance | null
  ready: boolean
  error: Error | null
}

const FilterCopilotContext = createContext<FilterCopilotContextValue | null>(null)
FilterCopilotContext.displayName = 'FilterCopilotContext'

// ──────────── Provider Props ────────────

export interface FilterCopilotProviderProps {
  options: CreateFilterCopilotOptions
  async?: boolean
  children: ReactNode
}

// ──────────── Provider ────────────

export function FilterCopilotProvider({
  options,
  async: asyncInit,
  children,
}: FilterCopilotProviderProps) {
  const [state, setState] = useState<FilterCopilotContextValue>({
    copilot: null, ready: false, error: null,
  })

  const initRef = useRef(false)
  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    const needsAsync =
      asyncInit === true ||
      (typeof options.persist === 'object' && options.persist.type === 'indexedDB') ||
      typeof options.coldStart === 'function' ||
      options.storageAdapter !== undefined

    if (needsAsync) {
      let cancelled = false
      createFilterCopilotAsync(optionsRef.current)
        .then((instance) => {
          if (!cancelled) setState({ copilot: instance, ready: true, error: null })
        })
        .catch((err) => {
          if (!cancelled) setState({ copilot: null, ready: false, error: err instanceof Error ? err : new Error(String(err)) })
        })
      return () => { cancelled = true }
    } else {
      try {
        const instance = createFilterCopilot(optionsRef.current)
        setState({ copilot: instance, ready: true, error: null })
      } catch (err) {
        setState({ copilot: null, ready: false, error: err instanceof Error ? err : new Error(String(err)) })
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
