/**
 * useCopilot — Copilot 推荐 Hook
 *
 * 在 universal-filter 的 React 体系内使用推荐引擎。
 * 与现有 useFilter / useField / useOptions 体系无缝配合。
 *
 * @example
 * ```tsx
 * function BrandSelect() {
 *   const { sortOptions, recommendValues } = useCopilot();
 *   const { data: brands, isLoading, search } = useOptions({ ... });
 *
 *   // 对 useOptions 返回的选项按推荐分排序
 *   const sortedBrands = useMemo(
 *     () => brands ? sortOptions('brand', context, brands) : [],
 *     [brands, sortOptions, context],
 *   );
 *
 *   return <Select options={sortedBrands} loading={isLoading} onSearch={search} />;
 * }
 * ```
 */

import { useMemo } from 'react';
import { useFilter } from '../../hooks/useFilter';
import { COPILOT_PLUGIN_NAME } from './plugin';
import type { CopilotPluginApi, FilterSelection, Suggestion, ValueSuggestion, RecommendOptions, RecommendValuesOptions } from './types';
import type { Draft, UseFilterInput } from '../../core/types';

export interface UseCopilotReturn {
  /**
   * 推荐下一步应使用的筛选器
   */
  recommend: (context: string[] | FilterSelection[], options?: RecommendOptions) => Suggestion[];

  /**
   * 推荐筛选器内各值的排序
   */
  recommendValues: (
    targetKey: string,
    context: FilterSelection[],
    allValues?: string[],
    options?: RecommendValuesOptions,
  ) => ValueSuggestion[];

  /**
   * 对任意选项列表按推荐分排序
   * 兼容 universal-filter 的 OptionItem 类型
   */
  sortOptions: <T extends { label: string; value: string | number }>(
    targetKey: string,
    context: FilterSelection[],
    options: T[],
  ) => (T & { score: number; reason?: string })[];

  /**
   * 从当前 filter 的 draft/applied 中提取 context
   * 便捷方法——自动将当前已设置的筛选器转为 FilterSelection[]
   */
  currentContext: FilterSelection[];

  /**
   * Copilot 插件是否可用
   */
  available: boolean;
}

// 空操作（插件不存在时的安全降级）
const NOOP_RECOMMEND = () => [] as Suggestion[];
const NOOP_RECOMMEND_VALUES = () => [] as ValueSuggestion[];
const NOOP_SORT = <T extends { label: string; value: string | number }>(
  _targetKey: string,
  _context: FilterSelection[],
  options: T[],
) => options.map((o) => ({ ...o, score: 0 as number, reason: undefined as string | undefined }));

/**
 * 从 draft 数据中提取 FilterSelection[]
 */
function extractContext(draft: Record<string, unknown>): FilterSelection[] {
  const result: FilterSelection[] = [];
  if (!draft || typeof draft !== 'object') return result;

  for (const key of Object.keys(draft)) {
    const value = draft[key];
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      const strValues = value.filter((v) => v !== undefined && v !== null && v !== '').map(String);
      if (strValues.length > 0) result.push({ key, value: strValues });
    } else if (typeof value === 'string' || typeof value === 'number') {
      result.push({ key, value: String(value) });
    }
  }
  return result;
}

/**
 * 获取 Copilot 推荐能力
 *
 * 如果 copilot-plugin 未注册，所有方法安全降级为空操作。
 */
export function useCopilot<TDraft extends Draft = Draft>(
  input?: UseFilterInput<TDraft>,
): UseCopilotReturn {
  const filter = useFilter(input);

  return useMemo(() => {
    // 尝试获取 copilot 插件 API
    const pluginState = filter.plugin.getState<CopilotPluginApi>(COPILOT_PLUGIN_NAME);
    const available = !!pluginState?.recommend;

    if (!available || !pluginState) {
      return {
        recommend: NOOP_RECOMMEND,
        recommendValues: NOOP_RECOMMEND_VALUES,
        sortOptions: NOOP_SORT,
        currentContext: [],
        available: false,
      };
    }

    return {
      recommend: pluginState.recommend,
      recommendValues: pluginState.recommendValues,
      sortOptions: pluginState.sortOptions as UseCopilotReturn['sortOptions'],
      get currentContext() {
        return extractContext(filter.draft as Record<string, unknown>);
      },
      available: true,
    };
  }, [filter]);
}
