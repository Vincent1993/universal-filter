/**
 * Filter Copilot SDK — 双维度智能推荐
 *
 * 维度 1：recommend()        — 推荐下一步用哪个筛选器
 * 维度 2：recommendValues()  — 推荐筛选器内各值的排序（下拉列表排序）
 *
 * 对外入口：
 *   createFilterCopilot      — 同步创建
 *   createFilterCopilotAsync — 异步创建
 */

// Re-export factory (核心 SDK API)
export { createFilterCopilot, createFilterCopilotAsync } from './core/factory'
export type { CreateFilterCopilotOptions, FilterCopilotInstance } from './core/factory'

// 工具函数
export { sortOptions, mergeSearchResults } from './utils/sortOptions'

// 导出类型
export type { FilterDef, FilterDefs, FilterSelection } from './types/Filter'
export type { FilterAction } from './types/Behavior'
export type { Suggestion, ValueSuggestion } from './types/Suggestion'
export type { OptionItem, ScoredOption, ValueSourceConfig, ValueSourceType, AsyncLoaderParams, SearchLoaderParams } from './types/Option'
export type { RecommendOptions, RecommendValuesOptions } from './core/Recommender'
export type { BehaviorData } from './core/BehaviorStore'
export type { StorageAdapter, PersistOptions } from './types/Storage'
export type { SortOptionsParams, MergeSearchParams } from './utils/sortOptions'
