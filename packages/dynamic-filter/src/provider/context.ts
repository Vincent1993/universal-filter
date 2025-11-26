import { createContext } from 'react';
import type { FilterRegistry } from '../types';
import type { ISchema } from '@formily/json-schema';

/**
 * 动态筛选器 Context 值
 */
export interface DynamicFilterContextValue {
  /** 筛选器注册表 */
  registry: FilterRegistry;
  /** 已注册的 SchemaField 组件 */
  SchemaField: any;
  /** 组装后的完整 Schema (Registry + Layout) */
  assembledSchema?: ISchema;
}

/**
 * 动态筛选器 Context
 * 提供注册表和 SchemaField 给下游组件使用
 */
export const DynamicFilterContext = createContext<DynamicFilterContextValue | null>(null);

DynamicFilterContext.displayName = 'DynamicFilterContext';
