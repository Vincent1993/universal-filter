import { merge, cloneDeep } from 'es-toolkit/compat';

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

  // 逐个合并覆盖配置
  overrides.forEach(override => {
    merge(result, override, (objValue, srcValue) => {
      // 数组采用替换策略：直接用源数组替换目标数组
      // 这对于 enum、validators 等数组配置非常有用
      if (Array.isArray(srcValue)) {
        return srcValue;
      }
      // 其他类型使用默认的深度合并行为
      return undefined;
    });
  });

  return result;
}

