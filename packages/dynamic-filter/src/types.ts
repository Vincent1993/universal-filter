import type { ISchema } from '@formily/json-schema';
import type { FilterApi } from '@dfx/universal-filter';
import type { ReactNode } from 'react';
import { createSchemaField } from '@formily/react';

/**
 * 筛选器定义配置
 * 每个配置代表一个独立的 Formily 字段 Schema（可通过自定义组件承载复杂交互）
 */
export interface FilterDefinition extends ISchema {
  /** 唯一标识 (如 'filter:keyword-search') */
  id: string;
  /** 显示名称 */
  name: string;
  /** 分类 */
  category?: string;
  /** 默认值 */
  defaultValue?: any;
  /** 元数据 */
  metadata?: Record<string, any>;

  // 继承 ISchema 的所有属性
  // type, properties, items, etc.
}

/**
 * DynamicFilterProvider 配置
 */
export interface DynamicFilterProviderProps {
  children: ReactNode;

  /** 筛选器定义列表(服务端返回或外部注入) */
  definitions: FilterDefinition[];

  /** SchemaField 组件映射 */
  components: Record<string, any>;

  /** 表达式作用域 */
  scope?: Record<string, any>;
}

/**
 * 动态字段管理器返回
 */
export interface DynamicFieldsManager {
  /** 筛选器注册表 */
  registry: FilterRegistry;
  /** 已注册的 SchemaField 组件 */
  SchemaField: ReturnType<typeof createSchemaField>
  /** 组装后的完整 Schema */
  assembledSchema?: ISchema;
  /** 默认的筛选器 ID 列表 */
  defaultFilters: string[];
  /** universal-filter 实例 */
  filter: FilterApi;
  /** 当前激活的筛选器 ID 列表 */
  activeFilters: string[];
  /** 激活筛选器的 Schema */
  activeSchema: ISchema;
  /** 可添加的筛选器定义列表 */
  availableFilters: FilterDefinition[];
  /** 添加筛选器 */
  addFilter: (filterId: string) => void;
  /** 删除筛选器 */
  removeFilter: (filterId: string) => void;
  /** 重置筛选器 */
  resetFilters: () => void;
  /** 直接设置筛选器列表 */
  setFilters: (filterIds: string[]) => void;
}

/**
 * 筛选器注册表
 */
export interface FilterRegistry {
  /** 配置映射表 */
  definitions: Map<string, FilterDefinition>;
  /** 根据 ID 获取定义 */
  getById: (id: string) => FilterDefinition | undefined;
  /** 获取所有定义 */
  getAll: () => FilterDefinition[];
  /** 搜索定义 */
  search: (keyword: string) => FilterDefinition[];
  /** 根据元数据获取定义 */
  getMetadataById: (id: string) => FilterDefinition['metadata'] | undefined;
}

/**
 * useDynamicFilters Hook 选项
 */
export interface UseDynamicFiltersOptions {
  /** 默认展示的筛选器 ID 列表 */
  defaultFilters?: string[];
}
