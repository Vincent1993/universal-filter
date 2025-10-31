import type { TransformerConfig, TransformContext } from './types';

/**
 * 辅助函数：创建简单的键名 codec 转换器
 */
export function createKeyTransformTransformer(
  keyTransform: (key: string) => string,
  options?: {
    name?: string;
    direction?: 'inbound' | 'outbound' | 'both';
  }
): TransformerConfig {
  const transform = (data: unknown): unknown => {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(transform);
    }

    if (typeof data === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        const newKey = keyTransform(key);
        result[newKey] = transform(value);
      }
      return result;
    }

    return data;
  };

  return {
    name: options?.name || 'key-transform',
    transform,
    reverseTransform: transform, // 双向转换相同
    direction: options?.direction || 'both',
  };
}

/**
 * 辅助函数：创建字段映射 codec 转换器
 */
export function createFieldMappingTransformer(
  fieldMapping: Record<string, string | string[]>,
  options?: {
    name?: string;
    direction?: 'inbound' | 'outbound' | 'both';
  }
): TransformerConfig {
  // 创建反向映射
  const reverseMapping: Record<string, string> = {};
  for (const [target, source] of Object.entries(fieldMapping)) {
    if (typeof source === 'string') {
      reverseMapping[source] = target;
    } else {
      // 多个源字段映射到同一个目标字段
      for (const src of source) {
        reverseMapping[src] = target;
      }
    }
  }

  const transform = (data: unknown, context?: TransformContext): unknown => {
    if (data === null || data === undefined || typeof data !== 'object') {
      return data;
    }

    const source = data as Record<string, unknown>;
    // inbound 使用 fieldMapping，outbound 使用 reverseMapping
    const mapping = context?.direction === 'outbound' ? reverseMapping : fieldMapping;
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(source)) {
      const targetKey = mapping[key];
      if (targetKey) {
        if (typeof targetKey === 'string') {
          result[targetKey] = value;
        } else {
          // 多个源字段合并到一个目标字段
          const target = targetKey[0];
          if (!result[target]) {
            result[target] = {};
          }
          (result[target] as Record<string, unknown>)[key] = value;
        }
      } else {
        // 保留未映射的字段
        result[key] = value;
      }
    }

    return result;
  };

  const reverseTransform = (data: unknown, context?: TransformContext): unknown => {
    // reverseTransform 是 transform 的反向操作，始终使用反向映射（reverseMapping）
    // 例如：first_name -> firstName（与 fieldMapping 的方向相反）
    if (data === null || data === undefined || typeof data !== 'object') {
      return data;
    }

    const source = data as Record<string, unknown>;
    const mapping = reverseMapping;
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(source)) {
      const targetKey = mapping[key];
      if (targetKey) {
        result[targetKey] = value;
      } else {
        // 保留未映射的字段
        result[key] = value;
      }
    }

    return result;
  };

  return {
    name: options?.name || 'field-mapping',
    transform,
    reverseTransform,
    direction: options?.direction || 'both',
  };
}

