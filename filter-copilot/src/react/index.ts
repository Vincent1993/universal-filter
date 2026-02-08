/**
 * Filter Copilot — React Headless Components
 *
 * 与 SDK 核心完全分离的 React 接入层。
 * 只提供状态管理和 hooks，不渲染任何 UI。
 *
 * @example
 * ```tsx
 * import { FilterCopilotProvider, useRecommendations, useRecorder } from 'filter-copilot/react'
 *
 * function App() {
 *   return (
 *     <FilterCopilotProvider options={{ userId: 'u1', filterDefs }}>
 *       <FilterPanel />
 *     </FilterCopilotProvider>
 *   )
 * }
 *
 * function FilterPanel() {
 *   const { suggestions } = useRecommendations(['category'])
 *   const { record } = useRecorder()
 *   // ... 自定义 UI
 * }
 * ```
 */

// Provider
export { FilterCopilotProvider } from './context'
export type { FilterCopilotProviderProps, FilterCopilotContextValue } from './context'

// Hooks
export { useFilterCopilot } from './useFilterCopilot'
export type { UseFilterCopilotReturn } from './useFilterCopilot'

export { useRecommendations } from './useRecommendations'
export type { UseRecommendationsReturn } from './useRecommendations'

export { useRecorder } from './useRecorder'
export type { UseRecorderReturn } from './useRecorder'

// Re-export core types for convenience
export type { Suggestion } from '../types/Suggestion'
export type { FilterAction } from '../types/Behavior'
export type { FilterDef, FilterDefs } from '../types/Filter'
export type { RecommendOptions } from '../core/Recommender'
export type { CreateFilterCopilotOptions, FilterCopilotInstance } from '../index'
