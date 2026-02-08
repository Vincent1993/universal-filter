/**
 * Copilot 插件类型定义
 *
 * 将 filter-copilot 推荐引擎整合到 universal-filter 插件体系中
 */

import type { BehaviorData } from '../../../filter-copilot/src/core/BehaviorStore';
import type { FilterSelection } from '../../../filter-copilot/src/types/Filter';
import type { Suggestion, ValueSuggestion } from '../../../filter-copilot/src/types/Suggestion';
import type { FilterAction } from '../../../filter-copilot/src/types/Behavior';
import type { OptionItem as CopilotOptionItem, ScoredOption } from '../../../filter-copilot/src/types/Option';
import type { RecommendOptions, RecommendValuesOptions } from '../../../filter-copilot/src/core/Recommender';

// Re-export for convenience
export type {
  FilterSelection,
  Suggestion,
  ValueSuggestion,
  FilterAction,
  BehaviorData,
  ScoredOption,
  RecommendOptions,
  RecommendValuesOptions,
};
export type { CopilotOptionItem };

/**
 * Copilot 插件配置项
 */
export interface CopilotPluginOptions {
  /**
   * 用户标识（用于隔离不同用户的行为数据）
   */
  userId: string;

  /**
   * 是否持久化行为数据到 localStorage
   * @default true
   */
  persist?: boolean;

  /**
   * 冷启动种子数据
   * 当用户无任何历史行为时，用此数据初始化推荐引擎
   */
  coldStart?: BehaviorData;

  /**
   * 是否在 apply:success 时自动记录行为
   * @default true
   */
  autoRecord?: boolean;

  /**
   * 要追踪的字段列表
   * 不指定则追踪 applied 中所有有值的字段
   */
  trackFields?: string[];

  /**
   * 筛选器定义（用于推荐引擎的 dependsOn 规则）
   * 不提供时自动从 applied 字段推断（无 dependsOn 约束）
   */
  filterDefs?: Record<string, { label: string; dependsOn?: string[]; weight?: number }>;
}

/**
 * Copilot 插件对外暴露的 API
 *
 * 通过 filter.plugin.getState<CopilotPluginApi>('copilot-plugin') 获取
 */
export interface CopilotPluginApi {
  /**
   * 维度 1：推荐下一步应使用的筛选器
   *
   * @param context 当前已选筛选器（key-only 或 key+value）
   */
  recommend: (context: string[] | FilterSelection[], options?: RecommendOptions) => Suggestion[];

  /**
   * 维度 2：推荐筛选器内各值的排序
   *
   * 用于下拉列表选项重排序
   *
   * @param targetKey 目标筛选器 key
   * @param context 当前已选筛选器（带值）
   * @param allValues 全部可选值
   */
  recommendValues: (
    targetKey: string,
    context: FilterSelection[],
    allValues?: string[],
    options?: RecommendValuesOptions,
  ) => ValueSuggestion[];

  /**
   * 对选项列表按推荐分排序
   *
   * 与现有 OptionItem 兼容 — 接受任意 { label, value, ... } 数组
   */
  sortOptions: <T extends { label: string; value: string | number }>(
    targetKey: string,
    context: FilterSelection[],
    options: T[],
  ) => (T & { score: number; reason?: string })[];

  /**
   * 手动记录一次筛选行为（不等 apply:success）
   */
  record: (action: FilterAction) => void;

  /**
   * 导出行为数据
   */
  exportData: () => BehaviorData;

  /**
   * 导入行为数据
   */
  importData: (data: unknown, merge?: boolean) => void;

  /**
   * 重置行为数据
   */
  resetData: () => void;
}
