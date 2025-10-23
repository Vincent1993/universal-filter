import { cloneDeep } from 'es-toolkit';
import type { Draft, Plugin } from '../core/types';

export interface UrlSyncAdapter {
  read(): string;
  write(search: string): void;
  subscribe?(listener: (search: string) => void): () => void;
}

export interface UrlSyncPluginOptions<TDraft extends Draft> {
  adapter: UrlSyncAdapter;
  serialize?: (ctx: { draft: TDraft; payload: unknown }) => Record<string, string | string[] | null | undefined>;
  deserialize?: (params: Record<string, string | string[]>) => Partial<TDraft>;
  decode?: boolean;
  mode?: 'replace' | 'merge';
}

export function createUrlSyncPlugin<TDraft extends Draft = Draft>(
  options: UrlSyncPluginOptions<TDraft>
): Plugin<TDraft> {
  const serialize = options.serialize ?? defaultSerialize;
  const deserialize = options.deserialize ?? defaultDeserialize;
  const mode = options.mode ?? 'merge';
  const decode = options.decode ?? true;
  let suppress = false;

  const plugin: Plugin<TDraft> = {
    name: 'url-sync-plugin',
    priority: 100,
    async onInit({ root, setReady }) {
      const search = options.adapter.read();
      if (search) {
        const params = parseSearch(search);
        const values = deserialize(params);
        if (values && Object.keys(values).length > 0) {
          root.load(cloneDeep(values), { mode, decode });
        }
      }

      if (typeof options.adapter.subscribe === 'function') {
        options.adapter.subscribe((nextSearch) => {
          if (suppress) return;
          const params = parseSearch(nextSearch);
          const values = deserialize(params);
          root.load(cloneDeep(values), { mode, decode });
        });
      }
      setReady(true);
      // 在初始化后订阅 apply:success 写回 URL
      root.events.on(
        'apply:success',
        ({ draft, payload }: { draft: TDraft; payload: unknown }) => {
          const params = serialize({ draft, payload });
          const next = stringifyParams(params);
          suppress = true;
          try {
            options.adapter.write(next ? `?${next}` : '');
          } finally {
            suppress = false;
          }
        }
      );
    },
    // 不依赖 onAfterApply；订阅事件总线
    onDestroy({ root }) {
      // no-op
    },
  };
  return plugin;
}

// 订阅 apply:success 并写回 URL（在插件初始化时挂载监听）
function attachAfterApply<TDraft extends Draft>(
  root: { events: { on: (event: 'apply:success', cb: (payload: { draft: TDraft; payload: unknown }) => void) => () => void } },
  options: UrlSyncPluginOptions<TDraft>,
  serialize: (ctx: { draft: TDraft; payload: unknown }) => Record<string, string | string[] | null | undefined>
) {
  let suppress = false;
  root.events.on('apply:success', ({ draft, payload }: { draft: TDraft; payload: unknown }) => {
    const params = serialize({ draft, payload });
    const next = stringifyParams(params);
    suppress = true;
    try {
      options.adapter.write(next ? `?${next}` : '');
    } finally {
      suppress = false;
    }
  });
}

// 保留原实现以兼容
function legacyAfterApply<TDraft extends Draft>(
  options: UrlSyncPluginOptions<TDraft>,
  serialize: (ctx: { draft: TDraft; payload: unknown }) => Record<string, string | string[] | null | undefined>
) {
  let suppress = false;
  return ({ draft, payload }: { draft: TDraft; payload: unknown }) => {
      const params = serialize({ draft, payload });
      const next = stringifyParams(params);
      suppress = true;
      try {
        options.adapter.write(next ? `?${next}` : '');
      } finally {
        suppress = false;
      }
  };
}

function parseSearch(input: string): Record<string, string | string[]> {
  const query = input.startsWith('?') ? input.slice(1) : input;
  const params = new URLSearchParams(query);
  const result: Record<string, string | string[]> = {};
  for (const key of params.keys()) {
    const values = params.getAll(key);
    result[key] = values.length > 1 ? values : values[0] ?? '';
  }
  return result;
}

function stringifyParams(params: Record<string, string | string[] | null | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(key, item);
      }
    } else {
      searchParams.set(key, value);
    }
  }
  return searchParams.toString();
}

function defaultSerialize<TDraft extends Draft>(ctx: { draft: TDraft; payload: unknown }) {
  const source = ctx.payload ?? ctx.draft;
  const params: Record<string, string | string[] | null | undefined> = {};
  for (const [key, value] of Object.entries(source ?? {})) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (Array.isArray(value)) {
      params[key] = value.map((item) => String(item));
    } else if (typeof value === 'object') {
      params[key] = JSON.stringify(value);
    } else {
      params[key] = String(value);
    }
  }
  return params;
}

function defaultDeserialize<TDraft extends Draft>(
  params: Record<string, string | string[]>
): Partial<TDraft> {
  const draft: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      draft[key] = value.map((item) => coerceValue(item));
    } else {
      draft[key] = coerceValue(value);
    }
  }
  return draft as Partial<TDraft>;
}

function coerceValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (value === 'undefined') return undefined;
  const numeric = Number(value);
  if (!Number.isNaN(numeric) && value.trim() !== '') {
    return numeric;
  }
  try {
    if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
      return JSON.parse(value);
    }
  } catch (err) {
    // ignore parse errors and fall through to string return
  }
  return value;
}
