import { createContext, type Context } from 'react';
import type { DynamicFieldsManager } from '../types';


/**
 * 动态筛选器 Context
 * 提供注册表和 SchemaField 给下游组件使用
 */
export const DynamicFilterContext: Context<DynamicFieldsManager | null> = createContext<DynamicFieldsManager | null>(null);

DynamicFilterContext.displayName = 'DynamicFilterContext';
