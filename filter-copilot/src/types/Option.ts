import type { FilterSelection } from './Filter'

// ──────────── 选项数据模型 ────────────

/**
 * 一个筛选器备选项
 *
 * 无论来源是枚举、接口还是搜索，统一为此结构。
 * 业务方可通过 extra 携带任意附加数据。
 */
export interface OptionItem<T = unknown> {
  /** 选项显示文本 */
  label: string
  /** 选项值（用于提交 / 匹配推荐） */
  value: string
  /** 是否禁用 */
  disabled?: boolean
  /** 业务方附加数据（透传，不参与推荐计算） */
  extra?: T
}

/**
 * 经过推荐排序后的选项
 *
 * 在原始 OptionItem 基础上增加推荐分数和原因。
 */
export interface ScoredOption<T = unknown> extends OptionItem<T> {
  /** 推荐分数（0 = 无信号） */
  score: number
  /** 推荐原因（如 'context', 'frequency'） */
  reason?: string
}

// ──────────── 值来源配置 ────────────

/**
 * 值来源类型
 *
 * - enum:    静态枚举（前端写死 / 配置中心拉取后缓存）
 * - async:   异步加载（接口拉取，可能依赖上游筛选器实现级联）
 * - search:  搜索型（用户输入关键词后异步获取）
 */
export type ValueSourceType = 'enum' | 'async' | 'search'

/** 异步加载器的参数 */
export interface AsyncLoaderParams {
  /** 当前已选筛选器上下文（级联时可从中取上游值） */
  context: FilterSelection[]
}

/** 搜索加载器的参数 */
export interface SearchLoaderParams extends AsyncLoaderParams {
  /** 用户输入的搜索关键词 */
  query: string
}

/**
 * 筛选器值来源配置
 *
 * 描述某个筛选器的备选值从哪里来、如何获取。
 */
export type ValueSourceConfig<T = unknown> =
  | {
      type: 'enum'
      /** 静态选项列表 */
      options: OptionItem<T>[]
    }
  | {
      type: 'async'
      /** 异步加载函数（返回选项列表） */
      loader: (params: AsyncLoaderParams) => Promise<OptionItem<T>[]>
      /**
       * 是否在上游 context 变化时自动重新加载
       * 典型场景：选了省份后重新加载城市列表
       * @default true
       */
      reloadOnContextChange?: boolean
    }
  | {
      type: 'search'
      /** 搜索函数（返回匹配的选项列表） */
      searcher: (params: SearchLoaderParams) => Promise<OptionItem<T>[]>
      /**
       * 搜索防抖延迟（毫秒）
       * @default 300
       */
      debounceMs?: number
      /**
       * 空 query 时是否加载（如展示热门选项）
       * @default false
       */
      loadOnEmpty?: boolean
    }
