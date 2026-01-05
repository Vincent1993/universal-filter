import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import { createSchemaField } from '@formily/react';
import type { ISchema } from '@formily/json-schema';
import { DynamicFilterContext } from './context';
import { Processor } from '../core/schema-processor';
import type {
  DynamicFilterProviderProps,
  FilterRegistry,
  FilterDefinition
} from '../types';
import { useFilter } from '@dfx/universal-filter';

/**
 * 检查动态筛选器是否准备就绪
 *
 * 确保 definitions 和 schema 都准备好后才允许渲染子组件
 *
 * @param definitions 筛选器定义列表
 * @param schema 服务端布局 Schema
 * @param assembledSchema 组装后的 Schema
 * @returns 是否准备就绪
 *
 * @example
 * ```tsx
 * const isReady = useDynamicFilterReady(definitions, schema, assembledSchema);
 * if (!isReady) return <Loading />;
 * ```
 */
export function useDynamicFilterReady(
  definitions: FilterDefinition[],
  schema: ISchema | undefined,
  assembledSchema: ISchema | undefined
): boolean {
  return useMemo(() => {
    // 检查 definitions 是否存在且不为空
    const hasDefinitions = Array.isArray(definitions) && definitions.length > 0;

    // 检查 schema 是否存在
    const hasSchema = !!schema;

    // 如果提供了 schema，则必须成功组装出 assembledSchema
    // 如果没有提供 schema，则只需要 definitions 准备好即可
    if (hasSchema) {
      return hasDefinitions && !!assembledSchema;
    }

    // 如果没有 schema，只需要 definitions 准备好即可
    return hasDefinitions;
  }, [definitions, schema, assembledSchema]);
}

/**
 * 动态筛选器 Provider
 *
 * 完成所有注册工作:
 * 1. 创建筛选器定义注册表
 * 2. 注册 SchemaField 组件
 * 3. 组装 Server Layout 和 Registry，生成完整的 Assembled Schema
 *
 * @example
 * ```tsx
 * <DynamicFilterProvider
 *   schema={serverLayoutSchema}
 *   definitions={FILTER_DEFINITIONS}
 *   components={{ Input, Select }}
 *   scope={{ someUtil }}
 * >
 *   <YourApp />
 * </DynamicFilterProvider>
 * ```
 */
export function DynamicFilterProvider(
  props: DynamicFilterProviderProps & { schema?: ISchema }
): ReactElement {
  const {
    children,
    definitions,
    components,
    scope = {},
    schema: serverLayoutSchema
  } = props;

  const filter = useFilter()

  // 1. 创建注册表
  const registry = useMemo<FilterRegistry>(() => {
    const definitionMap = new Map<string, FilterDefinition>();
    const serverLayoutFilterIds = Object.values(serverLayoutSchema?.properties ?? {})?.map(i => i['x-filter-id']);
    // 将定义数组转换为 Map
    definitions.forEach(def => {
      if (!def.id) {
        console.warn('[Dynamic Filter] 定义缺少 id 字段，已跳过:', def);
        return;
      }
      // 只有在服务端布局中存在的筛选器才需要注册
      if(!serverLayoutFilterIds?.includes(def.id)) return;
      definitionMap.set(def.id, def);
    });

    // 返回注册表对象，提供便捷的查询方法
    return {
      definitions: definitionMap,

      getById: (id: string) => definitionMap.get(id),

      getMetadataById: (id: string) => definitionMap.get(id)?.metadata,

      getAll: () => Array.from(definitionMap.values()),

      search: (keyword: string) => {
        return Array.from(definitionMap.values()).filter(d =>
          d.title.includes?.(keyword) || d.metadata?.category?.includes(keyword)
        );
      }
    };
  }, [definitions, serverLayoutSchema]);

  // 2. 创建 SchemaField
  const SchemaField = useMemo(() => {
    return createSchemaField({ components, scope });
  }, [components, scope]);

  // 3. 组装 Schema (Assembly Phase)
  // 当 Server Layout 或 Registry 变化时，重新组装
  const assembledSchema = useMemo(() => {
    if (!serverLayoutSchema) return undefined;
    return Processor.assemble(serverLayoutSchema, registry);
  }, [serverLayoutSchema, registry]);

  // 检查是否准备就绪
  const isReady = useDynamicFilterReady(definitions, serverLayoutSchema, assembledSchema);

  // 当所有条件都满足时，触发一次 apply（仅触发一次）
  // 使用 ref 追踪是否已触发，确保只触发一次
  const hasAppliedRef = useRef(false);

  useEffect(() => {
    // 如果 isReady 变为 false，重置标记（允许在新的数据准备好时再次触发）
    if (!isReady) {
      hasAppliedRef.current = false;
      return;
    }

    // 检查所有条件是否都满足：isReady && filter.ready
    if (isReady && filter.ready && !hasAppliedRef.current) {
      hasAppliedRef.current = true;
      filter.apply();
    }
  }, [isReady, filter.ready, filter]);

  // 4. 获取默认的激活筛选器 ID 列表
  const defaultFilters = useMemo(() => {
    return Processor.getDefaultFilterIds(serverLayoutSchema);
  }, [serverLayoutSchema]);

  // 5. 管理当前激活的筛选器状态
  const [activeFilters, setActiveFilters] = useState<string[]>(defaultFilters);

  // 添加筛选器
  const addFilter = useCallback((filterId: string) => {
    setActiveFilters(prev => {
      if (prev.includes(filterId)) {
        return prev;
      }
      return [...prev, filterId];
    });
  }, []);

  // 删除筛选器
  const removeFilter = useCallback((filterId: string) => {
    setActiveFilters(prev => prev.filter(id => id !== filterId));

    // 清理对应的表单字段
    if (assembledSchema?.properties) {
      Object.keys(assembledSchema.properties).forEach(key => {
        const fieldSchema = (assembledSchema.properties as any)[key];
        if (fieldSchema['x-filter-id'] === filterId) {
          // 清理 Formily 字段模型(防止内存泄漏)
          filter.form.clearFormGraph(key);
          // 删除字段值
          filter.deleteValue(key);
        }
      });
    }
  }, [filter, assembledSchema]);

  // 重置为默认筛选器
  const resetFilters = useCallback(() => {
    setActiveFilters(defaultFilters);

    // 清理非默认筛选器的值
    if (assembledSchema?.properties) {
      Object.keys(assembledSchema.properties).forEach(key => {
        const fieldSchema = (assembledSchema.properties as any)[key];
        const filterId = fieldSchema['x-filter-id'];

        if (filterId && !defaultFilters.includes(filterId)) {
          filter.form.clearFormGraph(key);
          filter.form.deleteValuesIn(key);
        }
      });
    }
  }, [defaultFilters, filter, assembledSchema]);

  // 直接设置筛选器列表
  const setFilters = useCallback((filterIds: string[]) => {
    const removedFilters = activeFilters.filter(id => !filterIds.includes(id));

    // 清理被移除筛选器的值
    if (assembledSchema?.properties) {
      Object.keys(assembledSchema.properties).forEach(key => {
        const fieldSchema = (assembledSchema.properties as any)[key];
        const filterId = fieldSchema['x-filter-id'];

        if (filterId && removedFilters.includes(filterId)) {
          filter.form.clearFormGraph(key);
          filter.form.deleteValuesIn(key);
        }
      });
    }

    setActiveFilters(filterIds);
  }, [activeFilters, filter, assembledSchema]);

  // 6. 提供 Context
  const contextValue = useMemo(() => ({
    registry,
    SchemaField,
    assembledSchema,
    filter,
    defaultFilters,
    activeFilters,
    addFilter,
    removeFilter,
    resetFilters,
    setFilters
  }), [registry, SchemaField, assembledSchema, filter, defaultFilters, activeFilters, addFilter, removeFilter, resetFilters, setFilters]);

  return (
    <DynamicFilterContext.Provider value={contextValue}>
      {children}
    </DynamicFilterContext.Provider>
  );
}
