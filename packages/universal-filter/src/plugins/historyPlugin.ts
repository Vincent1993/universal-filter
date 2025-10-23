import { cloneDeep } from 'es-toolkit';
import type { Draft, Plugin } from '../core/types';

export interface HistoryPluginOptions<TDraft extends Draft = Record<string, unknown>> {
  limit?: number;
  onHistoryChange?: (history: ReadonlyArray<{ draft: TDraft; applied: unknown }>) => void;
}

export function createHistoryPlugin<TDraft extends Draft = Record<string, unknown>>(
  options: HistoryPluginOptions<TDraft> = {}
): Plugin<TDraft> {
  const { limit = 20, onHistoryChange } = options;
  let history: Array<{ draft: TDraft; applied: unknown }> = [];

  const push = (draft: TDraft, applied: unknown) => {
    history = [...history, { draft: cloneDeep(draft), applied: cloneDeep(applied) }];
    if (history.length > limit) {
      history = history.slice(history.length - limit);
    }
    onHistoryChange?.(history);
  };

  return {
    name: 'history-plugin',
    priority: 10,
    onInit({ root, setReady }) {
      push(root.draft, root.applied);
      root.events.on('apply:success', ({ draft, payload }) => {
        push(draft as TDraft, payload);
      });
      setReady(true);
    },
  };
}
