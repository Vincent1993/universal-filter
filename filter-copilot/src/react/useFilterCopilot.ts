/**
 * useFilterCopilot — 主 hook
 *
 * 获取 FilterCopilot SDK 实例及其状态。
 * Headless 设计：不绑定任何 UI，只暴露数据和方法。
 */

import type { FilterCopilotInstance } from '../index'
import { useFilterCopilotContext } from './context'

export interface UseFilterCopilotReturn {
  /** SDK 实例，未就绪时为 null */
  copilot: FilterCopilotInstance | null
  /** 是否已完成初始化（可安全调用 copilot 方法） */
  ready: boolean
  /** 初始化错误（如有） */
  error: Error | null
}

/**
 * 获取 FilterCopilot 实例
 *
 * @example
 * ```tsx
 * const { copilot, ready } = useFilterCopilot()
 * if (ready) {
 *   const suggestions = copilot.recommend(['category'])
 * }
 * ```
 */
export function useFilterCopilot(): UseFilterCopilotReturn {
  const { copilot, ready, error } = useFilterCopilotContext()
  return { copilot, ready, error }
}
