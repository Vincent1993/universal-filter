import { useState, useMemo, useCallback } from 'react';
import type { ISchema } from '@formily/json-schema';
import type { DynamicFieldsManager, UseDynamicFiltersOptions } from '../types';
import { useFilterRegistry } from './useFilterRegistry';
import { Processor } from '../core/schema-processor';

/**
 * 动态筛选器管理 Hook
 *
 * 核心 Hook，提供筛选器的动态添加/删除能力，自动管理表单值的清理。
 *
 * 注意: 这个 Hook 只负责 React 状态管理和表单清理，所有 Schema 操作都委托给 Processor。
 *
 * @param options - Hook 选项
 * @param options.filter - universal-filter 实例
 * @param options.assembledSchema - 完整组装后的 Schema (来自 Provider)
 * @param options.defaultFilters - 默认展示的筛选器 ID 列表
 *
 * @returns 动态筛选器管理器
 *
 * @example
 * ```tsx
 * const {
 *   activeSchema,
 *   addFilter,
 *   removeFilter
 * } = useDynamicFilters({
 *   filter,
 *   assembledSchema,
 *   defaultFilters: ['filter:keyword']
 * })
 *
 * // 渲染已激活的筛选器
 * <SchemaField schema={activeSchema} />
 *
 * // 添加筛选器
 * <Button onClick={() => addFilter('filter:status')}>添加状态筛选</Button>
 *
 * // 删除筛选器
 * <Button onClick={() => removeFilter('filter:keyword')}>删除关键词</Button>
 * ```
 */
export function useDynamicFilters(
  options: UseDynamicFiltersOptions
): DynamicFieldsManager {
  const { filter, assembledSchema, defaultFilters = [] } = options;
  const registry = useFilterRegistry();

  // 当前激活的筛选器 ID 列表
  const [activeFilters, setActiveFilters] = useState<string[]>(defaultFilters);

  // 根据激活筛选器构建动态 Schema (委托给 Processor)
  const activeSchema = useMemo<ISchema>(() => {
    return Processor.project(assembledSchema, activeFilters);
  }, [assembledSchema, activeFilters]);

  // 获取可添加的筛选器定义列表 (委托给 Processor)
  const availableFilters = useMemo(() => {
    return Processor.getAvailableFilters(registry, activeFilters);
  }, [registry, activeFilters]);

  // 添加筛选器
  const addFilter = useCallback((filterId: string) => {
    if (!activeFilters.includes(filterId)) {
      setActiveFilters(prev => [...prev, filterId]);
    }
  }, [activeFilters]);

  // 删除筛选器
  const removeFilter = useCallback((filterId: string) => {
    setActiveFilters(prev => prev.filter(id => id !== filterId));

    // 清理对应的表单字段
    // 查找该筛选器下的所有字段
    if (assembledSchema.properties) {
      Object.keys(assembledSchema.properties).forEach(key => {
        const fieldSchema = (assembledSchema.properties as any)[key];
        if (fieldSchema['x-filter-id'] === filterId) {
          // 清理 Formily 字段模型(防止内存泄漏)
          filter.form.clearFormGraph(key);
          // 删除字段值
          filter.form.deleteValuesIn(key);
        }
      });
    }
  }, [filter, assembledSchema]);

  // 重置为默认筛选器
  const resetFilters = useCallback(() => {
    setActiveFilters(defaultFilters);

    // 清理非默认筛选器的值
    if (assembledSchema.properties) {
      Object.keys(assembledSchema.properties).forEach(key => {
        const fieldSchema = (assembledSchema.properties as any)[key];
        const filterId = fieldSchema['x-filter-id'];

        if (filterId && !defaultFilters.includes(filterId)) {
          filter.form.clearFormGraph(key);
          filter.form.deleteValuesIn(key);
        }
      });
    }
  }, [defaultFilters, filter, assembledSchema]);

  // 直接设置筛选器列表
  const setFilters = useCallback((filterIds: string[]) => {
    const removedFilters = activeFilters.filter(id => !filterIds.includes(id));

    // 清理被移除筛选器的值
    if (assembledSchema.properties) {
      Object.keys(assembledSchema.properties).forEach(key => {
        const fieldSchema = (assembledSchema.properties as any)[key];
        const filterId = fieldSchema['x-filter-id'];

        if (filterId && removedFilters.includes(filterId)) {
          filter.form.clearFormGraph(key);
          filter.form.deleteValuesIn(key);
        }
      });
    }

    setActiveFilters(filterIds);
  }, [activeFilters, filter, assembledSchema]);

  return {
    activeFilters,
    activeSchema,
    availableFilters,
    addFilter,
    removeFilter,
    resetFilters,
    setFilters
  };
}

