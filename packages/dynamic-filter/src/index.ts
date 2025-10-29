/**
 * @dfx/dynamic-filter
 *
 * Headless 动态筛选器系统
 * 基于 Formily Schema Patch 机制实现
 */

// ========== 类型导出 ==========
export type {
  FilterFieldConfig,
  DynamicFilterProviderProps,
  DynamicFieldsManager,
  FilterRegistry,
  UseDynamicFieldsOptions
} from './types';

// ========== Provider 导出 ==========
export { DynamicFilterProvider } from './provider/DynamicFilterProvider';

// ========== Hooks 导出 ==========
export { useDynamicFields } from './hooks/useDynamicFields';
export { useFilterRegistry } from './hooks/useFilterRegistry';
export { useSchemaField } from './hooks/useSchemaField';

// ========== 工具函数导出 ==========
export { mergeConfig } from './utils/merge';

// ========== 核心函数导出 (高级用法) ==========
export { createSchemaPatch } from './core/schema-patch';

