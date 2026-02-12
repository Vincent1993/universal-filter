/**
 * useFilterOptions — 全生命周期选项管理 hook
 *
 * 根据 valueSource 配置自动管理选项的获取、排序、状态。
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { FilterSelection } from '../types/Filter'
import type { OptionItem, ScoredOption, ValueSourceConfig } from '../types/Option'
import { sortOptions } from '../utils/sortOptions'
import { useFilterCopilotContext } from './context'

/** 稳定化数组引用 */
function useStableJSON<T>(value: T): T {
  const ref = useRef(value)
  const key = JSON.stringify(value)
  const prevKey = useRef(key)
  if (key !== prevKey.current) {
    prevKey.current = key
    ref.current = value
  }
  return ref.current
}

export interface UseFilterOptionsReturn<T = unknown> {
  options: ScoredOption<T>[]
  loading: boolean
  error: Error | null
  search: (query: string) => void
  query: string
  ready: boolean
  refresh: () => void
}

export function useFilterOptions<T = unknown>(
  targetKey: string,
  context: FilterSelection[],
  sourceConfig?: ValueSourceConfig<T>,
): UseFilterOptionsReturn<T> {
  const { copilot, ready } = useFilterCopilotContext()
  const stableContext = useStableJSON(context)

  const [rawOptions, setRawOptions] = useState<OptionItem<T>[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [query, setQuery] = useState('')
  const [version, setVersion] = useState(0)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seqRef = useRef(0)

  // 稳定化 sourceConfig 的 type（用于 useEffect 依赖）
  const sourceType = sourceConfig?.type
  // 保存最新的 sourceConfig 引用（用于回调中访问）
  const sourceRef = useRef(sourceConfig)
  sourceRef.current = sourceConfig

  // ── enum 型 ──
  useEffect(() => {
    if (sourceType !== 'enum') return
    const src = sourceRef.current
    if (src?.type !== 'enum') return
    setRawOptions(src.options)
    setLoading(false)
    setError(null)
  }, [sourceType]) // 只在 type 变化时触发

  // ── async 型 ──
  const asyncLoadedRef = useRef(false)
  useEffect(() => {
    if (sourceType !== 'async') return
    const src = sourceRef.current
    if (src?.type !== 'async') return

    const reloadOnCtx = src.reloadOnContextChange !== false
    if (!reloadOnCtx && asyncLoadedRef.current) return

    const seq = ++seqRef.current
    setLoading(true)
    setError(null)

    src.loader({ context: stableContext }).then(
      (result) => {
        if (seq === seqRef.current) {
          setRawOptions(result)
          setLoading(false)
          asyncLoadedRef.current = true
        }
      },
      (err) => {
        if (seq === seqRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setLoading(false)
        }
      },
    )
  }, [sourceType, stableContext])

  // ── search 型 ──
  const search = useCallback(
    (q: string) => {
      setQuery(q)
      const src = sourceRef.current
      if (src?.type !== 'search') return

      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }

      if (!q && !src.loadOnEmpty) {
        setRawOptions([])
        setLoading(false)
        return
      }

      setLoading(true)

      timerRef.current = setTimeout(() => {
        const seq = ++seqRef.current
        src.searcher({ query: q, context: stableContext }).then(
          (result) => {
            if (seq === seqRef.current) {
              setRawOptions(result)
              setLoading(false)
            }
          },
          (err) => {
            if (seq === seqRef.current) {
              setError(err instanceof Error ? err : new Error(String(err)))
              setLoading(false)
            }
          },
        )
      }, src.debounceMs ?? 300)
    },
    [stableContext],
  )

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  // ── 排序 ──
  const options = useMemo(() => {
    void version
    if (!copilot || !ready || rawOptions.length === 0) return []
    return sortOptions({ copilot, targetKey, context: stableContext, options: rawOptions })
  }, [copilot, ready, targetKey, stableContext, rawOptions, version])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  return { options, loading, error, search, query, ready, refresh }
}
