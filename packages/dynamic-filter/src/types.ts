import type { ISchema } from '@formily/json-schema';
import type { FilterApi } from '@dfx/universal-filter';
import type { ReactNode } from 'react';

/**
 * 筛选器字段配置项
 * 服务端返回或外部注入
 */
export interface FilterFieldConfig {
  /** 唯一标识 (如 'filter:keyword-search') */
  id: string;
  /** 显示名称 */
  name: string;
  /** 分类 */
  category?: string;
  /** Formily Schema 配置 */
  schema: ISchema;
  /** 默认值 */
  defaultValue?: any;
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * DynamicFilterProvider 配置
 */
export interface DynamicFilterProviderProps {
  children: ReactNode;

  /** 筛选器字段配置列表(服务端返回或外部注入) */
  filterConfigs: FilterFieldConfig[];

  /** SchemaField 组件映射 */
  components: Record<string, any>;

  /** 表达式作用域 */
  scope?: Record<string, any>;

  /** 是否自动初始化 Schema Patch */
  autoInitPatch?: boolean;
}

/**
 * 动态字段管理器返回
 */
export interface DynamicFieldsManager {
  /** 当前激活的字段 ID 列表 */
  activeFields: string[];
  /** 激活字段的 Schema */
  activeSchema: ISchema;
  /** 可添加的字段配置列表 */
  availableFields: FilterFieldConfig[];
  /** 添加字段 */
  addField: (fieldId: string) => void;
  /** 删除字段 */
  removeField: (fieldId: string) => void;
  /** 重置字段 */
  resetFields: () => void;
  /** 直接设置字段列表 */
  setFields: (fieldIds: string[]) => void;
}

/**
 * 筛选器注册表
 */
export interface FilterRegistry {
  /** 配置映射表 */
  configs: Map<string, FilterFieldConfig>;
  /** 根据 ID 获取配置 */
  getById: (id: string) => FilterFieldConfig | undefined;
  /** 获取所有配置 */
  getAll: () => FilterFieldConfig[];
  /** 根据分类获取配置 */
  getByCategory: (category: string) => FilterFieldConfig[];
  /** 搜索配置 */
  search: (keyword: string) => FilterFieldConfig[];
}

/**
 * useDynamicFields Hook 选项
 */
export interface UseDynamicFieldsOptions {
  /** universal-filter 实例 */
  filter: FilterApi;
  /** 服务端返回的 Schema */
  serverSchema: ISchema;
  /** 默认展示的字段 ID 列表 */
  defaultFields?: string[];
}

