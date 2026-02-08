/**
 * Filter Copilot — React Headless Components
 *
 * 与 SDK 核心完全分离的 React 接入层。
 * 只提供状态管理和 hooks，不渲染任何 UI。
 */

// Provider
export { FilterCopilotProvider } from './context'
export type { FilterCopilotProviderProps, FilterCopilotContextValue } from './context'

// Hooks
export { useFilterCopilot } from './useFilterCopilot'
export type { UseFilterCopilotReturn } from './useFilterCopilot'

export { useRecommendations } from './useRecommendations'
export type { UseRecommendationsReturn } from './useRecommendations'

export { useValueRecommendations } from './useValueRecommendations'
export type { UseValueRecommendationsReturn } from './useValueRecommendations'

export { useSortedOptions } from './useSortedOptions'
export type { UseSortedOptionsReturn } from './useSortedOptions'

export { useFilterOptions } from './useFilterOptions'
export type { UseFilterOptionsReturn } from './useFilterOptions'

export { useRecorder } from './useRecorder'
export type { UseRecorderReturn } from './useRecorder'

// Re-export core types
export type { Suggestion, ValueSuggestion } from '../types/Suggestion'
export type { FilterAction } from '../types/Behavior'
export type { FilterDef, FilterDefs, FilterSelection } from '../types/Filter'
export type { OptionItem, ScoredOption, ValueSourceConfig } from '../types/Option'
export type { RecommendOptions, RecommendValuesOptions } from '../core/Recommender'
export type { CreateFilterCopilotOptions, FilterCopilotInstance } from '../index'
