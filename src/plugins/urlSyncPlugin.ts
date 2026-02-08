import qs, { ParsedUrl } from 'query-string';
import type { Draft, Plugin } from '../core/types';
import type { IFormMergeStrategy } from '@formily/core';


export interface UrlSyncPluginOptions<TDraft extends Draft> {
  serialize?: (ctx: {
    draft: TDraft;
    payload: unknown;
  }) => Record<string, string | string[] | null | undefined>;
  /**
   * 从 URL 中解析出草稿数据
   */
  deserialize?: (params: Record<string, string | string[]>) => Partial<TDraft>;
  /**
   * URL 值与当前默认值的合并策略，默认为覆盖
   * @default 'overwrite'
   */
  mergeStrategy?: IFormMergeStrategy;
  /**
   * 提交时是否同步至 URL
   */
  syncToUrl?: boolean;
  /**
   * 初始化时是否同步 URL 的 query 到默认值
   * @default true
   */
  syncToInitialValues?: boolean;
}

function parseFromUrl(): ParsedUrl {
  return qs.parseUrl(window.location.href, {
    arrayFormat: 'comma',
    parseNumbers: true,
    parseBooleans: true,
    decode: true,
  });
}

export function createUrlSyncPlugin<TDraft extends Draft = Draft>(
  options: UrlSyncPluginOptions<TDraft> = {}
): Plugin<TDraft> {
  const mergeStrategy = options?.mergeStrategy ?? 'overwrite';
  const syncToInitialValues = options?.syncToInitialValues ?? true;

  const plugin: Plugin<TDraft> = {
    name: 'url-sync-plugin',
    async onInit({ filter, pluginManager }) {
      const search = parseFromUrl().query;

      if (search && Object.keys(search).length > 0 && syncToInitialValues) {
        filter.form.setValues(search as Partial<TDraft>, mergeStrategy);
        filter.setInitialValues(search as Partial<TDraft>, mergeStrategy);
      }

      pluginManager.markReady(plugin.name, true);
    },
  };
  return plugin;
}
