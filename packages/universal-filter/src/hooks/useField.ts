import { useMemo } from 'react';
import { useField as formilyUseField } from '@formily/react';
import { useFilter } from './useFilter';
import { createFieldApi } from '../core/fieldHelpers';
import type { FieldApi, UseFieldOptions } from '../core/types';

/**
 * useField Hook - 基于 Formily useField 的最小包装
 * 如果提供 path，则从 form 查询该字段
 * 如果不提供 path，则使用当前 Formily 上下文中的字段
 */
export function useField(path?: string, options?: UseFieldOptions): FieldApi {
  const filter = useFilter(options);
  const form = filter.form;
  const formilyField = formilyUseField();

  const resolvedPath = useMemo((): string | undefined => {
    if (path) return path;

    // 尝试从 Formily 上下文推断路径
    if (formilyField) {
      // Formily Field 的 address.entire 或 path.toString()
      const field = formilyField;
      const entirePath = field.address?.entire;
      if (typeof entirePath === 'string') return entirePath;
      if (field.path?.toString) return field.path.toString();
    }

    return undefined;
  }, [path, formilyField]);

  if (!resolvedPath) {
    throw new Error('useField requires a path prop or to be used within a Formily Field component');
  }

  // 直接返回基于 Formily Field 的 FieldApi
  return useMemo(() => createFieldApi(form, resolvedPath!), [form, resolvedPath]);
}
