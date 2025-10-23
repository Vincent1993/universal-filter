import type { Form, GeneralField } from '@formily/core';
import type { FieldApi } from './types';

/**
 * 创建 FieldApi - 直接基于 Formily Field 进行最小化包装
 */
export function createFieldApi(form: Form, path: string): FieldApi {
  const field = form.query(path).take();

  if (!field) {
    throw new Error(`Field "${path}" not found in form`);
  }

  // 直接返回 Formily field，只添加必要的计算属性
  return Object.assign(field, {
    get visible() {
      return field.display === 'visible';
    },
    get meta(){
      return field.data
    },
    get error() {
      const errors = (field as any).errors || [];
      if (errors.length === 0) return undefined;
      const firstError = errors[0];
      if (typeof firstError === 'string') return firstError;
      if (firstError && typeof firstError === 'object' && 'message' in firstError) {
        return String(firstError.message);
      }
      return String(firstError);
    },
  }) as FieldApi;
}

/**
 * 从 path 字符串获取 Field 实例的辅助函数
 */
export function getField(form: Form, path: string): GeneralField | undefined {
  return form.query(path).take();
}
