import { Schema } from '@formily/json-schema';
import type { ISchema } from '@formily/json-schema';
import type { FilterRegistry } from '../types';
import { mergeConfig } from '../utils/merge';

/**
 * 创建 Schema Patch 函数
 * 返回注册和取消注册的方法
 *
 * @param registry - 筛选器注册表
 * @returns Schema Patch 管理器
 */
export function createSchemaPatch(registry: FilterRegistry) {
  let isRegistered = false;

  return {
    /**
     * 注册 Schema Patch 到 Formily
     * 拦截所有 Schema 并处理 x-component-id 标记
     */
    register() {
      if (isRegistered) {
        console.warn('[Dynamic Filter] Schema Patch 已经注册，跳过重复注册');
        return;
      }

      Schema.registerPatches((schema) => {
        return traverseSchema(schema, registry);
      });

      isRegistered = true;
    },

    /**
     * 取消注册(主要用于测试)
     * 注意: Formily 没有提供 unregister API
     */
    unregister() {
      // Formily 没有提供取消注册的方法
      // 这里只是标记状态，实际的 patch 仍会生效
      isRegistered = false;
    },

    /**
     * 检查是否已注册
     */
    isRegistered() {
      return isRegistered;
    }
  };
}

/**
 * 递归遍历 Schema 树
 * 处理每个节点，如果包含 x-component-id 则进行配置合并
 *
 * @param node - Schema 节点
 * @param registry - 筛选器注册表
 * @returns 处理后的 Schema 节点
 */
function traverseSchema(node: any, registry: FilterRegistry): any {
  if (!node || typeof node !== 'object') {
    return node;
  }

  // 处理 x-component-id 标记
  if (node['x-component-id']) {
    node = processComponentId(node, registry);
  }

  // 递归处理 properties
  if (node.properties) {
    Object.keys(node.properties).forEach(key => {
      node.properties[key] = traverseSchema(node.properties[key], registry);
    });
  }

  // 递归处理 items (数组项)
  if (node.items) {
    if (Array.isArray(node.items)) {
      node.items = node.items.map(item => traverseSchema(item, registry));
    } else {
      node.items = traverseSchema(node.items, registry);
    }
  }

  return node;
}

/**
 * 处理带有 x-component-id 的节点
 * 从注册表获取基础配置，并与服务端配置合并
 *
 * @param node - 包含 x-component-id 的 Schema 节点
 * @param registry - 筛选器注册表
 * @returns 合并后的 Schema 节点
 */
function processComponentId(node: any, registry: FilterRegistry): any {
  const componentId = node['x-component-id'];

  // 从注册表获取基础配置
  const config = registry.getById(componentId);
  if (!config) {
    console.warn(`[Dynamic Filter] 未找到配置: ${componentId}`);
    // 移除 x-component-id 标记，避免后续报错
    delete node['x-component-id'];
    return node;
  }

  // 提取服务端覆盖配置
  const serverOverride = { ...node };
  delete serverOverride['x-component-id'];

  // 合并配置: 基础配置 + 服务端覆盖
  // 1. 先从基础配置克隆
  let mergedSchema: ISchema = mergeConfig({}, config.schema);

  // 2. 如果有服务端覆盖配置，合并进去
  if (Object.keys(serverOverride).length > 0) {
    mergedSchema = mergeConfig(mergedSchema, serverOverride);
  }

  return mergedSchema;
}

