import qs from 'query-string';
import type { Draft, Plugin } from '../core/types';
import type { IFormMergeStrategy } from '@formily/core';


export interface UrlSyncPluginOptions<TDraft extends Draft> {
  serialize?: (ctx: {
    draft: TDraft;
    payload: unknown;
  }) => Record<string, string | string[] | null | undefined>;
  deserialize?: (params: Record<string, string | string[]>) => Partial<TDraft>;
  decode?: boolean;
  mode?: IFormMergeStrategy;
}

export function createUrlSyncPlugin<TDraft extends Draft = Draft>(
  options: UrlSyncPluginOptions<TDraft>
): Plugin<TDraft> {
  const mode = options.mode ?? 'merge';
  let suppress = false;

  const plugin: Plugin<TDraft> = {
    name: 'url-sync-plugin',
    priority: 100,
    async onInit({ root, setReady }) {
      const search = qs.parseUrl(window.location.href, {
        arrayFormat: 'comma',
        parseNumbers: true,
        parseBooleans: true
      }).query;

      if (search) {
        if (search && Object.keys(search).length > 0) {
          root.setInitialValues(search as Partial<TDraft>, mode);
        }
      }


      setReady(true);
      // 在初始化后订阅 apply:success 写回 URL
      // root..on(
      //   'apply:success',
      //   ({ draft, payload }: { draft: TDraft; payload: unknown }) => {
      //     const params = serialize({ draft, payload });
      //     const next = stringifyParams(params);
      //     suppress = true;
      //     try {
      //       options.adapter.write(next ? `?${next}` : '');
      //     } finally {
      //       suppress = false;
      //     }
      //   }
      // );
    },
    // 不依赖 onAfterApply；订阅事件总线
    onDestroy({ root }) {
      // no-op
    },
  };
  return plugin;
}

