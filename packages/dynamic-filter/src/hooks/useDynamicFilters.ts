import { useMemo, useContext } from 'react';
import type { ISchema } from '@formily/json-schema';
import type { DynamicFieldsManager } from '../types';
import { Processor } from '../core/schema-processor';
import { DynamicFilterContext } from '../provider/context';

/**
 * 动态筛选器管理 Hook
 *
 * 从 Context 中获取所有状态和操作方法，提供筛选器的动态管理能力。
 *
 * @returns 动态筛选器管理器，包含:
 * - registry: 筛选器注册表
 * - SchemaField: 已注册的 SchemaField 组件
 * - assembledSchema: 组装后的完整 Schema
 * - filter: universal-filter 实例
 * - activeFilters: 当前激活的筛选器 ID 列表
 * - activeSchema: 激活筛选器的 Schema
 * - availableFilters: 可添加的筛选器定义列表
 * - addFilter: 添加筛选器方法
 * - removeFilter: 删除筛选器方法
 * - resetFilters: 重置筛选器方法
 * - setFilters: 直接设置筛选器列表方法
 *
 * @example
 * ```tsx
 * const {
 *   registry,
 *   SchemaField,
 *   activeSchema,
 *   addFilter,
 *   removeFilter
 * } = useDynamicFilters()
 *
 * // 渲染已激活的筛选器
 * <SchemaField schema={activeSchema} />
 *
 * // 添加筛选器
 * <Button onClick={() => addFilter('filter:status')}>添加状态筛选</Button>
 *
 * // 删除筛选器
 * <Button onClick={() => removeFilter('filter:keyword')}>删除关键词</Button>
 *
 * // 访问注册表
 * const config = registry.getById('filter:keyword')
 * ```
 */
export function useDynamicFilters(): DynamicFieldsManager {
  const context = useContext(DynamicFilterContext);

  if (!context) {
    throw new Error('useDynamicFilters 必须在 DynamicFilterProvider 内部使用');
  }

  const {
    registry,
    SchemaField,
    assembledSchema,
    filter,
    activeFilters,
    addFilter,
    removeFilter,
    resetFilters,
    setFilters,
    defaultFilters
  } = context;

  // 根据激活筛选器构建动态 Schema (委托给 Processor)
  const activeSchema = useMemo<ISchema>(() => {
    // 如果没有 assembledSchema，返回空的 Schema 对象
    if (!assembledSchema) {
      return { type: 'object', properties: {} };
    }
    return Processor.project(assembledSchema, activeFilters);
  }, [assembledSchema, activeFilters]);

  // 获取可添加的筛选器定义列表 (委托给 Processor)
  const availableFilters = useMemo(() => {
    return Processor.getAvailableFilters(registry, activeFilters);
  }, [registry, activeFilters]);

  return {
    defaultFilters,
    registry,
    SchemaField,
    assembledSchema,
    filter,
    activeFilters,
    activeSchema,
    availableFilters,
    addFilter,
    removeFilter,
    resetFilters,
    setFilters,
  };
}

