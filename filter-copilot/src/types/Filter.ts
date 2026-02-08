export interface FilterDef {
  label: string
  dependsOn?: string[]
  weight?: number
}

export type FilterDefs = Record<string, FilterDef>
