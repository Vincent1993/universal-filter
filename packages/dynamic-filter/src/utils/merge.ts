import { cloneDeep } from 'es-toolkit/compat';

/**
 * 深度合并配置
 * 使用 es-toolkit 的 merge 处理对象深度合并
 * 数组采用替换策略(后者替换前者)
 *
 * @param base - 基础配置对象
 * @param overrides - 要合并的覆盖配置列表
 * @returns 合并后的新对象
 *
 * @example
 * ```ts
 * const base = { a: 1, b: { c: 2 }, d: [1, 2] }
 * const override = { b: { c: 3 }, d: [3, 4, 5] }
 * const result = mergeConfig(base, override)
 * // result: { a: 1, b: { c: 3 }, d: [3, 4, 5] }
 * ```
 */
export function mergeConfig<T = any>(
  base: T,
  ...overrides: Partial<T>[]
): T {
  // 克隆基础对象，避免修改原对象
  const result = cloneDeep(base);

  overrides.forEach(override => {
    if (!override) return;
    deepMerge(result as any, override as any);
  });

  return result;
}

function deepMerge(target: any, source: any) {
  if (!source || typeof source !== 'object') {
    return target;
  }

  Object.keys(source).forEach(key => {
    const value = source[key];

    if (Array.isArray(value)) {
      target[key] = cloneDeep(value);
      return;
    }

    if (value && typeof value === 'object') {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      deepMerge(target[key], value);
      return;
    }

    target[key] = value;
  });

  return target;
}

