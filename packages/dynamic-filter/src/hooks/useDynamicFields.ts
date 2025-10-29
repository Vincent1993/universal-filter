import { useState, useMemo, useCallback } from 'react';
import type { ISchema } from '@formily/json-schema';
import type { DynamicFieldsManager, UseDynamicFieldsOptions } from '../types';
import { useFilterRegistry } from './useFilterRegistry';

/**
 * 动态字段管理 Hook
 *
 * 核心 Hook，提供字段的动态添加/删除能力，自动管理表单值的清理。
 *
 * @param options - Hook 选项
 * @param options.filter - universal-filter 实例
 * @param options.serverSchema - 服务端返回的 Schema (包含 x-component-id)
 * @param options.defaultFields - 默认展示的字段 ID 列表
 *
 * @returns 动态字段管理器
 *
 * @example
 * ```tsx
 * const {
 *   activeSchema,
 *   addField,
 *   removeField
 * } = useDynamicFields({
 *   filter,
 *   serverSchema,
 *   defaultFields: ['filter:keyword']
 * })
 *
 * // 渲染激活的字段
 * <SchemaField schema={activeSchema} />
 *
 * // 添加字段
 * <Button onClick={() => addField('filter:status')}>添加状态筛选</Button>
 *
 * // 删除字段
 * <Button onClick={() => removeField('filter:keyword')}>删除关键词</Button>
 * ```
 */
export function useDynamicFields(
  options: UseDynamicFieldsOptions
): DynamicFieldsManager {
  const { filter, serverSchema, defaultFields = [] } = options;
  const registry = useFilterRegistry();

  // 当前激活的字段 ID 列表
  const [activeFields, setActiveFields] = useState<string[]>(defaultFields);

  // 根据激活字段构建动态 Schema
  const activeSchema = useMemo<ISchema>(() => {
    const activeProperties: Record<string, any> = {};

    // 遍历服务端 Schema，只保留激活字段
    if (serverSchema.properties) {
      Object.keys(serverSchema.properties).forEach(key => {
        const fieldSchema = serverSchema.properties![key];
        const componentId = fieldSchema['x-component-id'];

        // 检查该字段是否在激活列表中
        if (componentId && activeFields.includes(componentId)) {
          activeProperties[key] = fieldSchema;
        }
      });
    }

    return {
      ...serverSchema,
      properties: activeProperties
    };
  }, [serverSchema, activeFields]);

  // 获取可添加的字段配置列表
  const availableFields = useMemo(() => {
    const allConfigs = registry.getAll();

    // 过滤掉已激活的字段
    return allConfigs.filter(config => !activeFields.includes(config.id));
  }, [registry, activeFields]);

  // 添加字段
  const addField = useCallback((fieldId: string) => {
    if (!activeFields.includes(fieldId)) {
      setActiveFields(prev => [...prev, fieldId]);
    }
  }, [activeFields]);

  // 删除字段
  const removeField = useCallback((fieldId: string) => {
    setActiveFields(prev => prev.filter(id => id !== fieldId));

    // 清理对应的表单字段
    // 需要找到该 fieldId 对应的字段名
    if (serverSchema.properties) {
      Object.keys(serverSchema.properties).forEach(key => {
        const fieldSchema = serverSchema.properties![key];
        if (fieldSchema['x-component-id'] === fieldId) {
          // 清理 Formily 字段模型(防止内存泄漏)
          filter.form.clearFormGraph(key);
          // 删除字段值
          filter.form.deleteValuesIn(key);
        }
      });
    }
  }, [filter, serverSchema]);

  // 重置为默认字段
  const resetFields = useCallback(() => {
    setActiveFields(defaultFields);

    // 清理非默认字段的值
    if (serverSchema.properties) {
      Object.keys(serverSchema.properties).forEach(key => {
        const fieldSchema = serverSchema.properties![key];
        const componentId = fieldSchema['x-component-id'];

        if (componentId && !defaultFields.includes(componentId)) {
          filter.form.clearFormGraph(key);
          filter.form.deleteValuesIn(key);
        }
      });
    }
  }, [defaultFields, filter, serverSchema]);

  // 直接设置字段列表
  const setFields = useCallback((fieldIds: string[]) => {
    const removedFields = activeFields.filter(id => !fieldIds.includes(id));

    // 清理被移除字段的值
    if (serverSchema.properties) {
      Object.keys(serverSchema.properties).forEach(key => {
        const fieldSchema = serverSchema.properties![key];
        const componentId = fieldSchema['x-component-id'];

        if (componentId && removedFields.includes(componentId)) {
          filter.form.clearFormGraph(key);
          filter.form.deleteValuesIn(key);
        }
      });
    }

    setActiveFields(fieldIds);
  }, [activeFields, filter, serverSchema]);

  return {
    activeFields,
    activeSchema,
    availableFields,
    addField,
    removeField,
    resetFields,
    setFields
  };
}

