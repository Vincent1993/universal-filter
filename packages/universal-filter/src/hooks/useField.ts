import { useMemo } from 'react';
import type { GeneralField } from '@formily/core';
import type { ISchema } from '@formily/json-schema';
import {
  useField as formilyUseField,
  useFieldSchema as formilyUseFieldSchema,
  useExpressionScope as formilyUseExpressionScope,
} from '@formily/react';
import { useFilter } from './useFilter';
import type { EnhancedFieldApi, UseFieldOptions } from '../core/types';

// ==================== 辅助函数 ====================

/**
 * 从 Formily 上下文字段中解析字段路径
 */
function resolveFieldPath(contextField: GeneralField | undefined): string | undefined {
  if (!contextField) return undefined;

  const entirePath = contextField.address?.entire;
  if (typeof entirePath === 'string') return entirePath;

  if (contextField.path?.toString) {
    return contextField.path.toString();
  }

  return undefined;
}

/**
 * 获取字段错误信息
 */
function getFieldError(field: GeneralField): string | undefined {
  const errors = (field as any).errors || [];
  if (errors.length === 0) return undefined;

  const firstError = errors[0];
  if (typeof firstError === 'string') return firstError;

  if (firstError && typeof firstError === 'object' && 'message' in firstError) {
    return String(firstError.message);
  }

  return String(firstError);
}

/**
 * 创建增强的字段 API
 */
function createEnhancedField(
  field: GeneralField,
  schema: ISchema | null,
  scope: Record<string, any>,
  isContextField: boolean
): EnhancedFieldApi {
  return Object.assign(field, {
    get error() {
      return getFieldError(field);
    },
    schema,
    scope,
    isContextField,
  }) as EnhancedFieldApi;
}

// ==================== 主 Hook ====================

/**
 * useField Hook - 增强版 Formily useField
 *
 * 集成了 Formily 的三个核心 hooks：
 * - useField: 获取字段实例
 * - useFieldSchema: 获取字段的 JSON Schema 配置
 * - useExpressionScope: 获取表达式作用域
 *
 * @param path - 可选的字段路径
 *   - 如果提供 path，则从 form 查询指定路径的字段
 *   - 如果不提供 path，则使用当前 Formily 上下文中的字段
 *
 * @param options - 可选的配置项
 *   - instance: FilterApi 实例
 *   - namespace: 命名空间
 *
 * @see https://core.formilyjs.org/zh-CN/api/models/field
 *
 * @example
 * ```tsx
 * // 使用当前上下文字段
 * function MyFieldComponent() {
 *   const field = useField();
 *   return <div>{field.value} - {field.schema?.title}</div>;
 * }
 *
 * // 获取指定路径的字段
 * function MyComponent() {
 *   const nameField = useField('name');
 *   const ageField = useField('age');
 *   return <div>{nameField.value} - {ageField.value}</div>;
 * }
 * ```
 */
export function useField(path?: string, options?: UseFieldOptions): EnhancedFieldApi {
  // 1. 获取 filter 实例和 form
  const filter = useFilter(options);
  const form = filter.form;

  // 2. 获取 Formily 上下文信息
  const contextField = formilyUseField();
  const contextSchema = formilyUseFieldSchema();
  const contextScope = formilyUseExpressionScope();

  // 3. 解析字段路径
  const resolvedPath = useMemo(() => {
    // 如果传入了 path，直接使用
    if (path) return path;

    // 否则从 Formily 上下文推断路径
    return resolveFieldPath(contextField);
  }, [path, contextField]);

  // 4. 验证路径是否存在
  if (!resolvedPath) {
    throw new Error(
      'useField: 必须提供 path 参数或在 Formily Field 组件上下文中使用。'
    );
  }

  const isContextField = !path;

  // 5. 获取字段、schema 和 scope
  const { field, schema, scope } = useMemo(() => {
    // 使用上下文字段
    if (isContextField && contextField) {
      return {
        field: contextField,
        schema: contextSchema,
        scope: contextScope || {},
      };
    }

    // 查询目标字段
    const targetField = form.query(resolvedPath).take();
    if (!targetField) {
      throw new Error(
        `useField: 在表单中找不到字段 "${resolvedPath}"。\n` +
        `Field "${resolvedPath}" not found in form.`
      );
    }

    // 尝试获取字段的 schema（可能为 null）
    const targetSchema = (targetField as any).componentProps?.schema || null;

    return {
      field: targetField,
      schema: targetSchema,
      scope: contextScope || {},
    };
  }, [form, resolvedPath, isContextField, contextField, contextSchema, contextScope]);

  // 6. 创建并返回增强的字段 API
  return useMemo(
    () => createEnhancedField(field, schema, scope, isContextField),
    [field, schema, scope, isContextField]
  );
}
