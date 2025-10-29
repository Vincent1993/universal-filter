import { useContext } from 'react';
import { DynamicFilterContext } from '../provider/context';

/**
 * 获取已注册的 SchemaField 组件 Hook
 *
 * 返回在 DynamicFilterProvider 中注册的 SchemaField 组件，
 * 该组件已经包含了所有注册的组件和作用域。
 *
 * @throws {Error} 如果在 DynamicFilterProvider 外部使用
 *
 * @example
 * ```tsx
 * const SchemaField = useSchemaField()
 *
 * return <SchemaField schema={mySchema} />
 * ```
 */
export function useSchemaField() {
  const context = useContext(DynamicFilterContext);

  if (!context) {
    throw new Error(
      '[Dynamic Filter] useSchemaField 必须在 DynamicFilterProvider 内部使用'
    );
  }

  return context.SchemaField;
}

