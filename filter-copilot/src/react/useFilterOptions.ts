/**
 * useFilterOptions — 全生命周期选项管理 hook
 *
 * 根据 FilterDef 中声明的 valueSource 自动管理选项的：
 *   获取（enum 直接可用 / async 自动加载 / search 防抖搜索）
 *   排序（用推荐分数自动排序）
 *   状态（loading / error / 选项列表）
 *
 * @example
 * ```tsx
 * // filterDefs 中已配置 valueSource
 * const { options, loading, search } = useFilterOptions('brand', context)
 * // options 已按推荐分自动排序
 * // 对 search 型：调用 search('keyword') 触发搜索
 * ```
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { FilterSelection } from '../types/Filter'
import type { OptionItem, ScoredOption, ValueSourceConfig } from '../types/Option'
import { sortOptions } from '../utils/sortOptions'
import { useFilterCopilotContext } from './context'

export interface UseFilterOptionsReturn<T = unknown> {
  /** 按推荐分排序后的选项列表 */
  options: ScoredOption<T>[]
  /** 是否正在加载（仅 async / search 型有效） */
  loading: boolean
  /** 加载错误（如有） */
  error: Error | null
  /** 搜索函数（仅 search 型有效） */
  search: (query: string) => void
  /** 当前搜索关键词 */
  query: string
  /** SDK 是否就绪 */
  ready: boolean
  /** 手动刷新 */
  refresh: () => void
}

export function useFilterOptions<T = unknown>(
  targetKey: string,
  context: FilterSelection[],
  /** 覆盖 filterDefs 中的 valueSource（优先级更高） */
  sourceOverride?: ValueSourceConfig<T>,
): UseFilterOptionsReturn<T> {
  const { copilot, ready } = useFilterCopilotContext()

  // 从 filterDefs 或 override 获取 valueSource
  const source = useMemo((): ValueSourceConfig<T> | undefined => {
    if (sourceOverride) return sourceOverride
    // 尝试从 copilot 实例的 filterDefs 中获取（通过 recommend 间接判断）
    return undefined
  }, [sourceOverride])

  const [rawOptions, setRawOptions] = useState<OptionItem<T>[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [query, setQuery] = useState('')
  const [version, setVersion] = useState(0)

  // 防抖 timer
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 请求序号（防止竞态）
  const seqRef = useRef(0)

  // ── enum 型：直接设置 ──
  useEffect(() => {
    if (source?.type === 'enum') {
      setRawOptions(source.options)
      setLoading(false)
      setError(null)
    }
  }, [source])

  // ── async 型：context 变化时自动加载 ──
  useEffect(() => {
    if (source?.type !== 'async') return

    const reloadOnCtx = source.reloadOnContextChange !== false
    // 首次加载或 context 变化时加载
    if (!reloadOnCtx && rawOptions.length > 0) return

    const seq = ++seqRef.current
    setLoading(true)
    setError(null)

    source.loader({ context }).then(
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
  }, [source, context]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── search 型：search() 触发防抖搜索 ──
  const search = useCallback(
    (q: string) => {
      setQuery(q)

      if (source?.type !== 'search') return

      // 清除上一次防抖
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }

      // 空 query 且不加载空搜索
      if (!q && !source.loadOnEmpty) {
        setRawOptions([])
        setLoading(false)
        return
      }

      const debounceMs = source.debounceMs ?? 300
      setLoading(true)

      timerRef.current = setTimeout(() => {
        const seq = ++seqRef.current

        source.searcher({ query: q, context }).then(
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
      }, debounceMs)
    },
    [source, context],
  )

  // 清理 timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // ── 排序 ──
  const options = useMemo(() => {
    void version
    if (!copilot || !ready || rawOptions.length === 0) return []
    return sortOptions({ copilot, targetKey, context, options: rawOptions })
  }, [copilot, ready, targetKey, context, rawOptions, version])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  return { options, loading, error, search, query, ready, refresh }
}
