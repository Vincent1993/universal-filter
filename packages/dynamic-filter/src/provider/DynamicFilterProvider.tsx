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
const EMPTY_SCOPE: Record<string, unknown> = Object.freeze({});

export function DynamicFilterProvider(
  props: DynamicFilterProviderProps
): ReactElement {
  const {
    children,
    filterConfigs,
    components = {},
    scope,
    autoInitPatch = true
  } = props;

  const normalizedScope = useMemo(() => scope ?? EMPTY_SCOPE, [scope]);

  // 1. 创建注册表
  const registry = useMemo<FilterRegistry>(() => {
    const configMap = new Map<string, FilterFieldConfig>();
    const categoryMap = new Map<string, FilterFieldConfig[]>();
    const searchIndex: Array<{ config: FilterFieldConfig; tokens: string[] }> = [];

    const seenIds = new Set<string>();

    filterConfigs.forEach(config => {
      if (!config.id) {
        console.warn('[Dynamic Filter] 配置缺少 id 字段，已跳过:', config);
        return;
      }

      if (seenIds.has(config.id)) {
        console.warn(
          `[Dynamic Filter] 配置 id 重复，使用最后一次定义覆盖: ${config.id}`
        );
      }

      seenIds.add(config.id);
      configMap.set(config.id, config);
    });

    const allConfigs = Object.freeze(Array.from(configMap.values()));

    allConfigs.forEach(config => {
      if (config.category) {
        const normalizedCategory = config.category.trim().toLowerCase();
        const list = categoryMap.get(normalizedCategory);
        if (list) {
          list.push(config);
        } else {
          categoryMap.set(normalizedCategory, [config]);
        }
      }

      const tokens: string[] = [];
      if (config.id) tokens.push(String(config.id).toLowerCase());
      if (config.name) tokens.push(String(config.name).toLowerCase());
      if (config.category) tokens.push(config.category.trim().toLowerCase());
      searchIndex.push({ config, tokens });
    });

    const getAll = () => allConfigs.slice();

    return {
      configs: configMap,

      getById: (id: string) => configMap.get(id),

      getAll,

      getByCategory: (category: string) => {
        const normalized = category.trim().toLowerCase();
        const list = categoryMap.get(normalized);
        return list ? list.slice() : [];
      },

      search: (keyword: string) => {
        const normalizedKeyword = keyword.trim().toLowerCase();
        if (!normalizedKeyword) {
          return getAll();
        }

        return searchIndex
          .filter(entry =>
            entry.tokens.some(token => token.includes(normalizedKeyword))
          )
          .map(entry => entry.config);
      }
    };
  }, [filterConfigs]);

  // 2. 创建 SchemaField
  const SchemaField = useMemo(() => {
    return createSchemaField({ components, scope: normalizedScope });
  }, [components, normalizedScope]);

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

