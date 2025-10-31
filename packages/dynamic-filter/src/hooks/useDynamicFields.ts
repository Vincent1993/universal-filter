import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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

  const normalizedDefaultFields = useMemo(() => {
    const deduped: string[] = [];
    const seen = new Set<string>();

    defaultFields.forEach(fieldId => {
      if (!fieldId || seen.has(fieldId)) {
        return;
      }
      seen.add(fieldId);
      deduped.push(fieldId);
    });

    return deduped;
  }, [defaultFields]);

  const { propertyEntries, componentToPropertyMap } = useMemo(() => {
    const entries = Object.entries(serverSchema.properties ?? {});
    const map = new Map<string, string[]>();

    entries.forEach(([key, schema]) => {
      const componentId = schema?.['x-component-id'];
      if (!componentId) {
        return;
      }

      const list = map.get(componentId);
      if (list) {
        list.push(key);
      } else {
        map.set(componentId, [key]);
      }
    });

    return {
      propertyEntries: entries as Array<[string, any]>,
      componentToPropertyMap: map
    };
  }, [serverSchema]);

  // 当前激活的字段 ID 列表
  const lastDefaultRef = useRef<string[]>(normalizedDefaultFields);

  const [activeFields, setActiveFields] = useState<string[]>(normalizedDefaultFields);

  useEffect(() => {
    if (arrayShallowEqual(lastDefaultRef.current, normalizedDefaultFields)) {
      return;
    }

    lastDefaultRef.current = normalizedDefaultFields;
    setActiveFields(normalizedDefaultFields);
  }, [normalizedDefaultFields]);

  const cleanupFields = useCallback(
    (fieldIds: Iterable<string>) => {
      for (const fieldId of fieldIds) {
        const propertyKeys = componentToPropertyMap.get(fieldId);
        if (!propertyKeys) continue;

        propertyKeys.forEach(key => {
          filter.form.clearFormGraph(key);
          filter.form.deleteValuesIn(key);
        });
      }
    },
    [componentToPropertyMap, filter]
  );

  // 根据激活字段构建动态 Schema
  const activeSchema = useMemo<ISchema>(() => {
    const activeSet = new Set(activeFields);
    const activeProperties: Record<string, any> = {};

    propertyEntries.forEach(([key, fieldSchema]) => {
      const componentId = fieldSchema?.['x-component-id'];
      if (componentId && activeSet.has(componentId)) {
        activeProperties[key] = fieldSchema;
      }
    });

    return {
      ...serverSchema,
      properties: activeProperties
    };
  }, [serverSchema, propertyEntries, activeFields]);

  // 获取可添加的字段配置列表
  const availableFields = useMemo(() => {
    const activeSet = new Set(activeFields);
    return registry.getAll().filter(config => !activeSet.has(config.id));
  }, [registry, activeFields]);

  // 添加字段
  const addField = useCallback((fieldId: string) => {
    setActiveFields(prev => {
      if (prev.includes(fieldId)) {
        return prev;
      }
      return [...prev, fieldId];
    });
  }, []);

  // 删除字段
  const removeField = useCallback(
    (fieldId: string) => {
      setActiveFields(prev => prev.filter(id => id !== fieldId));
      cleanupFields([fieldId]);
    },
    [cleanupFields]
  );

  // 重置为默认字段
  const resetFields = useCallback(() => {
    const defaultSet = new Set(normalizedDefaultFields);
    const toCleanup = activeFields.filter(id => !defaultSet.has(id));
    if (toCleanup.length) {
      cleanupFields(toCleanup);
    }

    setActiveFields(normalizedDefaultFields);
  }, [activeFields, cleanupFields, normalizedDefaultFields]);

  // 直接设置字段列表
  const setFields = useCallback(
    (fieldIds: string[]) => {
      const deduped: string[] = [];
      const seen = new Set<string>();

      fieldIds.forEach(id => {
        if (!id || seen.has(id)) {
          return;
        }
        seen.add(id);
        deduped.push(id);
      });

      const nextSet = new Set(deduped);
      const removed = activeFields.filter(id => !nextSet.has(id));
      if (removed.length) {
        cleanupFields(removed);
      }

      setActiveFields(deduped);
    },
    [activeFields, cleanupFields]
  );

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

function arrayShallowEqual(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}


