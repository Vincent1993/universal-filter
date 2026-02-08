/**
 * useRecorder — 行为记录 hook
 *
 * 支持 key-only 和 key+value 两种记录模式。
 */

import { useCallback } from 'react'
import type { FilterAction } from '../types/Behavior'
import type { BehaviorData } from '../core/BehaviorStore'
import { useFilterCopilotContext } from './context'

export interface UseRecorderReturn {
  /** 记录一次筛选行为（支持 sequence 和 selections） */
  record: (action: FilterAction) => void
  /** 重置全部行为数据 */
  reset: () => void
  /** 导出行为数据 */
  exportData: () => BehaviorData
  /** 导入行为数据 */
  importData: (data: unknown, merge?: boolean) => void
  /** SDK 是否就绪 */
  ready: boolean
}

export function useRecorder(): UseRecorderReturn {
  const { copilot, ready } = useFilterCopilotContext()

  const record = useCallback(
    (action: FilterAction) => {
      if (copilot && ready) copilot.record(action)
    },
    [copilot, ready],
  )

  const reset = useCallback(() => {
    if (copilot && ready) copilot.reset()
  }, [copilot, ready])

  const exportData = useCallback((): BehaviorData => {
    if (copilot && ready) return copilot.export()
    return { transitions: {}, frequency: {} }
  }, [copilot, ready])

  const importData = useCallback(
    (data: unknown, merge = false) => {
      if (copilot && ready) copilot.import(data, merge)
    },
    [copilot, ready],
  )

  return { record, reset, exportData, importData, ready }
}
