import { useMemo, useEffect } from 'react';
import type { ReactElement } from 'react';
import { createSchemaField } from '@formily/react';
import { DynamicFilterContext } from './context';
import { createSchemaPatch } from '../core/schema-patch';
import type {
  DynamicFilterProviderProps,
  FilterRegistry,
  FilterFieldConfig
} from '../types';

/**
 * 动态筛选器 Provider
 *
 * 完成所有注册工作:
 * 1. 创建筛选器配置注册表
 * 2. 注册 SchemaField 组件
 * 3. 注册 Schema Patch
 *
 * @example
 * ```tsx
 * <DynamicFilterProvider
 *   filterConfigs={[{ id: 'filter:keyword', name: '关键词', schema: {...} }]}
 *   components={{ Input, Select }}
 *   scope={{ someUtil }}
 * >
 *   <YourApp />
 * </DynamicFilterProvider>
 * ```
 */
export function DynamicFilterProvider(
  props: DynamicFilterProviderProps
): ReactElement {
  const {
    children,
    filterConfigs,
    components,
    scope = {},
    autoInitPatch = true
  } = props;

  // 1. 创建注册表
  const registry = useMemo<FilterRegistry>(() => {
    const configMap = new Map<string, FilterFieldConfig>();

    // 将配置数组转换为 Map
    filterConfigs.forEach(config => {
      if (!config.id) {
        console.warn('[Dynamic Filter] 配置缺少 id 字段，已跳过:', config);
        return;
      }
      configMap.set(config.id, config);
    });

    // 返回注册表对象，提供便捷的查询方法
    return {
      configs: configMap,

      getById: (id: string) => configMap.get(id),

      getAll: () => Array.from(configMap.values()),

      getByCategory: (category: string) => {
        return Array.from(configMap.values()).filter(
          c => c.category === category
        );
      },

      search: (keyword: string) => {
        const lowerKeyword = keyword.toLowerCase();
        return Array.from(configMap.values()).filter(c =>
          c.name.toLowerCase().includes(lowerKeyword) ||
          c.id.toLowerCase().includes(lowerKeyword) ||
          c.category?.toLowerCase().includes(lowerKeyword)
        );
      }
    };
  }, [filterConfigs]);

  // 2. 创建 SchemaField
  const SchemaField = useMemo(() => {
    return createSchemaField({ components, scope });
  }, [components, scope]);

  // 3. 注册 Schema Patch
  useEffect(() => {
    if (!autoInitPatch) return;

    const patch = createSchemaPatch(registry);
    patch.register();

    // 清理函数(虽然 Formily 没有提供 unregister，但我们可以做一些清理工作)
    return () => {
      // 这里可以添加一些清理逻辑
    };
  }, [registry, autoInitPatch]);

  // 4. 提供 Context
  const contextValue = useMemo(() => ({
    registry,
    SchemaField
  }), [registry, SchemaField]);

  return (
    <DynamicFilterContext.Provider value={contextValue}>
      {children}
    </DynamicFilterContext.Provider>
  );
}

