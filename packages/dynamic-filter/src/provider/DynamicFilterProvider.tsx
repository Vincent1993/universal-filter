import { useMemo } from 'react';
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

  // 1. 创建注册表
  const registry = useMemo<FilterRegistry>(() => {
    const definitionMap = new Map<string, FilterDefinition>();

    // 将定义数组转换为 Map
    definitions.forEach(def => {
      if (!def.id) {
        console.warn('[Dynamic Filter] 定义缺少 id 字段，已跳过:', def);
        return;
      }
      definitionMap.set(def.id, def);
    });

    // 返回注册表对象，提供便捷的查询方法
    return {
      definitions: definitionMap,

      getById: (id: string) => definitionMap.get(id),

      getAll: () => Array.from(definitionMap.values()),

      getByCategory: (category: string) => {
        return Array.from(definitionMap.values()).filter(
          d => d.category === category
        );
      },

      search: (keyword: string) => {
        const lowerKeyword = keyword.toLowerCase();
        return Array.from(definitionMap.values()).filter(d =>
          d.name.toLowerCase().includes(lowerKeyword) ||
          d.id.toLowerCase().includes(lowerKeyword) ||
          d.category?.toLowerCase().includes(lowerKeyword)
        );
      }
    };
  }, [definitions]);

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

  // 4. 提供 Context
  const contextValue = useMemo(() => ({
    registry,
    SchemaField,
    assembledSchema
  }), [registry, SchemaField, assembledSchema]);

  return (
    <DynamicFilterContext.Provider value={contextValue}>
      {children}
    </DynamicFilterContext.Provider>
  );
}
