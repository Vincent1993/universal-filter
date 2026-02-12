/**
 * 筛选器维度推荐（推荐下一个用哪个筛选器）
 */
export interface Suggestion {
  key: string
  label: string
  score: number
  reason?: string
}

/**
 * 值维度推荐（推荐某个筛选器内哪些值排在前面）
 *
 * 用于下拉列表、多选面板等场景的选项排序
 */
export interface ValueSuggestion {
  value: string
  score: number
  reason?: string
}
