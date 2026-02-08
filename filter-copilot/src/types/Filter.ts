import type { ValueSourceConfig } from './Option'

export interface FilterDef {
  label: string
  dependsOn?: string[]
  weight?: number
  /**
   * 值来源配置（可选）
   *
   * 描述该筛选器的备选值从哪里来。
   * 主要供 React hooks（useFilterOptions）使用，SDK 核心不直接消费。
   *
   * @example
   * ```ts
   * // 枚举型
   * gender: {
   *   label: '性别',
   *   valueSource: { type: 'enum', options: [{ label: '男', value: 'male' }, { label: '女', value: 'female' }] }
   * }
   *
   * // 接口拉取（级联）
   * city: {
   *   label: '城市',
   *   dependsOn: ['province'],
   *   valueSource: { type: 'async', loader: ({ context }) => fetchCities(context.find(s => s.key === 'province')?.value) }
   * }
   *
   * // 搜索型
   * product: {
   *   label: '商品',
   *   valueSource: { type: 'search', searcher: ({ query }) => searchProducts(query) }
   * }
   * ```
   */
  valueSource?: ValueSourceConfig
}

export type FilterDefs = Record<string, FilterDef>

/**
 * 一个具体的筛选器选中状态：key + 选中的值
 */
export interface FilterSelection {
  key: string
  value: string | string[]
}
