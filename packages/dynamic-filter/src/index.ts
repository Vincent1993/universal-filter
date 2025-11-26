/**
 * @dfx/dynamic-filter
 *
 * Headless 动态筛选器系统
 * 基于 Schema Assembly 和 Projection 机制实现
 */

// ========== 类型导出 ==========
export type {
  FilterDefinition,
  DynamicFilterProviderProps,
  DynamicFieldsManager,
  FilterRegistry,
  UseDynamicFiltersOptions
} from './types';

// ========== Provider 导出 ==========
export { DynamicFilterProvider } from './provider/DynamicFilterProvider';

// ========== Hooks 导出 ==========
export { useDynamicFilters } from './hooks/useDynamicFilters';
export { useFilterRegistry } from './hooks/useFilterRegistry';
export { useSchemaField } from './hooks/useSchemaField';
export { useAssembledSchema } from './hooks/useAssembledSchema';

// 保留旧的 Hook 名称作为别名（向后兼容）
export { useDynamicFilters as useDynamicFields } from './hooks/useDynamicFilters';

// ========== 工具函数导出 ==========
export { mergeConfig } from './utils/merge';

// ========== 核心函数导出 (高级用法) ==========
export { Processor } from './core/schema-processor';
export type { SchemaProcessor } from './core/schema-processor';
