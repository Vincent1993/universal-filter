/**
 * URL 同步插件
 *
 * 提供 URL 查询参数与 Filter 状态之间的双向同步能力：
 * - **读取**：从 URL 解析参数并注入到表单 defaultValues / values
 * - **写入**：在 apply 成功后将 applied 数据同步回 URL
 *
 * ## 初始化时机 (timing)
 *
 * | 值 | 执行时机 | 适用场景 |
 * |---|---------|---------|
 * | `'beforeFormInit'` (默认) | Formily Form 创建之前 | URL 参数作为 defaultValues，影响 reset 行为 |
 * | `'onInit'` | 插件 onInit 阶段 | URL 参数覆盖已有值，不影响 defaultValues |
 *
 * @example
 * ```ts
 * // 基础用法：URL 参数注入为默认值，apply 后回写 URL
 * const filter = createFilter({
 *   defaultValues: { page: 1, keyword: '' },
 *   plugins: [
 *     createUrlSyncPlugin({
 *       syncToUrl: true,
 *     }),
 *   ],
 * });
 *
 * // 自定义序列化/反序列化
 * createUrlSyncPlugin({
 *   timing: 'beforeFormInit',
 *   syncToUrl: true,
 *   deserialize: (params) => ({
 *     keyword: String(params.q ?? ''),
 *     page: Number(params.p ?? 1),
 *   }),
 *   serialize: ({ applied }) => ({
 *     q: applied.keyword || undefined,   // undefined = 从 URL 移除
 *     p: applied.page > 1 ? String(applied.page) : undefined,
 *   }),
 * });
 * ```
 *
 * @module
 */

import qs from 'query-string';
import type { Draft, Plugin, FilterOptions, ApplySuccessPayload } from '../core/types';
import type { IFormMergeStrategy } from '@formily/core';

/**
 * URL 同步插件配置选项
 */
export interface UrlSyncPluginOptions<TDraft extends Draft = Draft> {
  /**
   * URL 参数注入时机
   *
   * - `'beforeFormInit'`：在 Formily Form 创建之前注入（通过 resolveOptions）
   *    URL 参数会成为 defaultValues 的一部分，reset 后会保留
   * - `'onInit'`：在插件 onInit 阶段注入（通过 setValues / setInitialValues）
   *    URL 参数在 Form 已创建后覆盖，reset 行为取决于 syncToInitialValues
   *
   * @default 'beforeFormInit'
   */
  timing?: 'beforeFormInit' | 'onInit';

  /**
   * 自定义反序列化函数：将 URL 参数转换为草稿数据
   *
   * 如果不提供，则直接使用 query-string 解析的结果。
   *
   * @example
   * ```ts
   * deserialize: (params) => ({
   *   keyword: String(params.q ?? ''),
   *   page: Number(params.p ?? 1),
   * })
   * ```
   */
  deserialize?: (params: Record<string, string | (string | null)[] | null>) => Partial<TDraft>;

  /**
   * 自定义序列化函数：将 applied 数据转换为 URL 参数
   *
   * 返回值中为 `undefined` 或 `null` 的键会从 URL 中移除。
   * 仅在 `syncToUrl: true` 时使用。
   *
   * @example
   * ```ts
   * serialize: ({ applied }) => ({
   *   q: applied.keyword || undefined,
   *   p: applied.page > 1 ? String(applied.page) : undefined,
   * })
   * ```
   */
  serialize?: (ctx: {
    draft: TDraft;
    applied: TDraft;
  }) => Record<string, string | string[] | null | undefined>;

  /**
   * URL 参数与 defaultValues 的合并策略
   * @default 'merge'
   */
  mergeStrategy?: IFormMergeStrategy;

  /**
   * apply 成功后是否将 applied 数据同步回 URL
   * @default false
   */
  syncToUrl?: boolean;

  /**
   * 初始化时是否同步 URL 参数到 initialValues（影响 reset 行为）
   * 仅在 `timing: 'onInit'` 模式下生效。
   * @default true
   */
  syncToInitialValues?: boolean;

  /**
   * URL 更新模式
   * - `'replace'`：使用 `history.replaceState`（不产生历史记录）
   * - `'push'`：使用 `history.pushState`（产生历史记录）
   * @default 'replace'
   */
  historyMode?: 'replace' | 'push';
}

/**
 * 从当前 URL 解析查询参数
 * @internal
 */
function parseFromUrl(): Record<string, string | (string | null)[] | null> {
  if (typeof window === 'undefined') return {};
  return qs.parse(window.location.search, {
    arrayFormat: 'comma',
    parseNumbers: true,
    parseBooleans: true,
    decode: true,
  });
}

/**
 * 将参数写入 URL
 * @internal
 */
function writeToUrl(
  params: Record<string, string | string[] | null | undefined>,
  mode: 'replace' | 'push'
): void {
  if (typeof window === 'undefined') return;

  const currentParams = qs.parse(window.location.search);
  const merged = { ...currentParams, ...params };

  // 移除值为 undefined / null / '' 的键
  for (const key of Object.keys(merged)) {
    if (merged[key] == null || merged[key] === '') {
      delete merged[key];
    }
  }

  const search = qs.stringify(merged, { arrayFormat: 'comma', skipNull: true, skipEmptyString: true });
  const newUrl = search
    ? `${window.location.pathname}?${search}${window.location.hash}`
    : `${window.location.pathname}${window.location.hash}`;

  if (mode === 'push') {
    window.history.pushState(null, '', newUrl);
  } else {
    window.history.replaceState(null, '', newUrl);
  }
}

/**
 * 创建 URL 同步插件
 *
 * @param options - 插件配置选项
 * @returns Plugin 对象（包含 resolveOptions 和 onInit）
 *
 * @example
 * ```ts
 * // 最简用法：URL 参数注入为默认值
 * createFilter({
 *   plugins: [createUrlSyncPlugin()],
 * });
 *
 * // 完整配置
 * createFilter({
 *   defaultValues: { page: 1, keyword: '' },
 *   plugins: [
 *     createUrlSyncPlugin({
 *       timing: 'beforeFormInit',
 *       syncToUrl: true,
 *       mergeStrategy: 'merge',
 *       historyMode: 'replace',
 *       deserialize: (params) => ({ keyword: String(params.q ?? '') }),
 *       serialize: ({ applied }) => ({ q: applied.keyword || undefined }),
 *     }),
 *   ],
 * });
 * ```
 */
export function createUrlSyncPlugin<TDraft extends Draft = Draft>(
  options: UrlSyncPluginOptions<TDraft> = {}
): Plugin<TDraft> {
  const {
    timing = 'beforeFormInit',
    mergeStrategy = 'merge',
    syncToUrl = false,
    syncToInitialValues = true,
    historyMode = 'replace',
    deserialize,
    serialize,
  } = options;

  const PLUGIN_NAME = 'url-sync-plugin';

  /**
   * 解析 URL 参数为草稿数据
   */
  function resolveUrlParams(): Partial<TDraft> | null {
    const raw = parseFromUrl();
    if (!raw || Object.keys(raw).length === 0) return null;

    if (deserialize) {
      return deserialize(raw);
    }
    return raw as Partial<TDraft>;
  }

  const plugin: Plugin<TDraft> = {
    name: PLUGIN_NAME,

    // === beforeFormInit 时机：通过 resolveOptions 在 Form 创建前注入 ===
    resolveOptions:
      timing === 'beforeFormInit'
        ? (opts: FilterOptions<TDraft>): FilterOptions<TDraft> => {
            const urlParams = resolveUrlParams();
            if (!urlParams) return opts;

            const currentDefaults = opts.defaultValues ?? ({} as TDraft);

            // 根据 mergeStrategy 合并 URL 参数到 defaultValues
            let mergedDefaults: TDraft;
            if (mergeStrategy === 'overwrite') {
              mergedDefaults = { ...currentDefaults, ...urlParams } as TDraft;
            } else if (mergeStrategy === 'deepMerge') {
              // 简单的深合并
              mergedDefaults = deepMerge(currentDefaults, urlParams) as TDraft;
            } else {
              // merge（默认）: 浅合并
              mergedDefaults = { ...currentDefaults, ...urlParams } as TDraft;
            }

            return { ...opts, defaultValues: mergedDefaults };
          }
        : undefined,

    // === onInit 阶段 ===
    onInit({ filter, pluginManager }) {
      // onInit 时机：在 Form 已创建后注入 URL 参数
      if (timing === 'onInit') {
        const urlParams = resolveUrlParams();
        if (urlParams) {
          filter.form.setValues(urlParams as Partial<TDraft>, mergeStrategy);
          if (syncToInitialValues) {
            filter.setInitialValues(urlParams as Partial<TDraft>, mergeStrategy);
          }
        }
      }

      // syncToUrl：apply 成功后写入 URL
      if (syncToUrl) {
        filter.hooks.applySuccess.tap(PLUGIN_NAME, ({ draft, payload }) => {
          const applied = payload.applied;
          const urlParams = serialize
            ? serialize({ draft, applied })
            : (applied as unknown as Record<string, string | string[] | null | undefined>);

          writeToUrl(urlParams, historyMode);
        });
      }

      pluginManager.markReady(PLUGIN_NAME, true);
    },
  };

  return plugin;
}

/**
 * 简单的深合并工具
 * @internal
 */
function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
