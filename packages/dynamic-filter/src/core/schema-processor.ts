import type { ISchema } from '@formily/json-schema';
import type { FilterRegistry, FilterDefinition } from '../types';
import { mergeConfig } from '../utils/merge';

export interface SchemaProcessor {
  /**
   * 组装 Schema
   * 将服务端 Layout Schema 与本地/远程 Registry 定义进行合并
   */
  assemble: (layout: ISchema, registry: FilterRegistry) => ISchema;

  /**
   * 投影 Schema
   * 根据激活的筛选器列表，生成最终用于渲染的 Schema
   */
  project: (assembledSchema: ISchema, activeIds: string[]) => ISchema;

  /**
   * 获取可用筛选器
   * 从 Registry 中获取当前 Schema 中尚未激活的筛选器
   */
  getAvailableFilters: (registry: FilterRegistry, activeIds: string[]) => FilterDefinition[];
}

/**
 * 核心 Schema 处理器
 * 纯函数实现，无副作用
 */
export const Processor: SchemaProcessor = {
  assemble(layout: ISchema, registry: FilterRegistry): ISchema {
    // 深拷贝避免修改原始引用
    const root = JSON.parse(JSON.stringify(layout));
    return traverseAndAssemble(root, registry);
  },

  project(assembledSchema: ISchema, activeIds: string[]): ISchema {
    if (!assembledSchema.properties) {
      return assembledSchema;
    }

    // 过滤出激活的筛选器对应的 properties
    const activeProperties: Record<string, any> = {};

    Object.keys(assembledSchema.properties).forEach(key => {
      const propSchema = (assembledSchema.properties as any)[key];
      const filterId = propSchema['x-filter-id'];

      if (filterId && activeIds.includes(filterId)) {
        activeProperties[key] = propSchema;
      }
    });

    return {
      ...assembledSchema,
      properties: activeProperties
    };
  },

  getAvailableFilters(registry: FilterRegistry, activeIds: string[]): FilterDefinition[] {
    const allDefinitions = registry.getAll();
    // 过滤掉已激活的筛选器
    return allDefinitions.filter(def => !activeIds.includes(def.id));
  }
};

// ========== 内部实现 ==========

/**
 * 递归遍历并组装
 */
function traverseAndAssemble(node: any, registry: FilterRegistry): any {
  if (!node || typeof node !== 'object') {
    return node;
  }

  // 1. 处理当前节点 (如果引用了筛选器定义)
  if (node['x-filter-id']) {
    node = processAssemblyNode(node, registry);
  }

  // 2. 递归处理 properties
  if (node.properties) {
    Object.keys(node.properties).forEach(key => {
      node.properties[key] = traverseAndAssemble(node.properties[key], registry);
    });
  }

  // 3. 递归处理 items
  if (node.items) {
    if (Array.isArray(node.items)) {
      node.items = node.items.map((item: any) => traverseAndAssemble(item, registry));
    } else {
      node.items = traverseAndAssemble(node.items, registry);
    }
  }

  // 4. 递归处理 additionalProperties
  if (node.additionalProperties && typeof node.additionalProperties === 'object') {
    node.additionalProperties = traverseAndAssemble(node.additionalProperties, registry);
  }

  return node;
}

/**
 * 处理单个节点的组装合并逻辑
 *
 * 核心逻辑：
 * 1. 从 Registry 获取完整的筛选器定义（一个完整的 Schema fragment）
 * 2. 将定义的 properties 合并到当前节点的父级
 * 3. 应用 Layout 中的覆盖配置
 */
function processAssemblyNode(node: any, registry: FilterRegistry): any {
  const filterId = node['x-filter-id'];

  // 查找筛选器定义
  const definition = registry.getById(filterId);
  if (!definition) {
    console.warn(`[Dynamic Filter] Assembly: Definition not found for id "${filterId}"`);
    const { 'x-filter-id': _, ...rest } = node;
    return rest;
  }

  // 提取 Layout 中的覆盖配置 (去除 id)
  const { 'x-filter-id': _, ...layoutOverride } = node;

  // 核心合并逻辑:
  // 1. 获取筛选器定义（这是一个完整的 Schema，可能有 properties）
  let merged = mergeConfig({}, definition);

  // 2. 应用 Layout 覆盖配置
  if (Object.keys(layoutOverride).length > 0) {
    merged = mergeConfig(merged, layoutOverride);
  }

  // 3. 标记所有子字段属于哪个筛选器（用于 Projection）
  const result = merged as any;

  // 无论单字段还是多字段，都需要确保根节点有 x-filter-id
  // 这样 Projection 逻辑才能正确识别
  result['x-filter-id'] = filterId;

  return result;
}
