export interface FilterDef {
  label: string
  dependsOn?: string[]
  weight?: number
}

export type FilterDefs = Record<string, FilterDef>

/**
 * 一个具体的筛选器选中状态：key + 选中的值
 *
 * 例如：{ key: 'category', value: '电子产品' }
 * 或多选：{ key: 'brand', value: ['Apple', 'Samsung'] }
 */
export interface FilterSelection {
  key: string
  value: string | string[]
}
