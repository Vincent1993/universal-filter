import type { FilterSelection } from './Filter'

export interface FilterAction {
  /**
   * 筛选器 key 序列（向后兼容）
   * 仅记录"用了哪些筛选器"的顺序
   */
  sequence: string[]
  /**
   * 带值的筛选器选择序列（增强模式）
   * 记录"用了哪些筛选器 + 每个选了什么值"
   *
   * 当 selections 存在时，同时更新 key 维度和 value 维度的行为数据。
   * 当仅有 sequence 时，只更新 key 维度（向后兼容）。
   */
  selections?: FilterSelection[]
  timestamp?: number
}
