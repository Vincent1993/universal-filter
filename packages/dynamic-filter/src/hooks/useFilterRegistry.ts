import { useContext } from 'react';
import { DynamicFilterContext } from '../provider/context';
import type { FilterRegistry } from '../types';

/**
 * 访问筛选器注册表 Hook
 *
 * 提供访问注册表的便捷方法，包括:
 * - getById: 根据 ID 获取配置
 * - getAll: 获取所有配置
 * - getByCategory: 根据分类获取配置
 * - search: 搜索配置
 *
 * @throws {Error} 如果在 DynamicFilterProvider 外部使用
 *
 * @example
 * ```tsx
 * const registry = useFilterRegistry()
 * const config = registry.getById('filter:keyword')
 * const allConfigs = registry.getAll()
 * ```
 */
export function useFilterRegistry(): FilterRegistry {
  const context = useContext(DynamicFilterContext);

  if (!context) {
    throw new Error(
      '[Dynamic Filter] useFilterRegistry 必须在 DynamicFilterProvider 内部使用'
    );
  }

  return context.registry;
}

