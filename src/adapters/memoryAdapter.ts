import { cloneDeep } from 'es-toolkit';
import type { Draft, FilterApi } from '../core/types';

export interface MemoryAdapterSnapshot<TDraft> {
  draft: TDraft;
  applied: unknown;
}

export interface MemoryAdapterApi<TDraft extends Draft> {
  readonly filter: FilterApi<TDraft>;
  getSnapshot(): MemoryAdapterSnapshot<TDraft>;
  setValue(path: string, value: unknown): void;
  subscribe(listener: (snapshot: MemoryAdapterSnapshot<TDraft>) => void): () => void;
  dispose(): void;
}

export function createMemoryAdapter<TDraft extends Draft>(filter: FilterApi<TDraft>): MemoryAdapterApi<TDraft> {
  let snapshot: MemoryAdapterSnapshot<TDraft> = {
    draft: cloneDeep(filter.draft),
    applied: cloneDeep(filter.applied),
  };

  const listeners = new Set<(state: MemoryAdapterSnapshot<TDraft>) => void>();
  const unsubscribe = filter.subscribe((state) => {
    snapshot = {
      draft: cloneDeep(state.draft),
      applied: cloneDeep(state.applied),
    };
    for (const listener of Array.from(listeners)) {
      listener(snapshot);
    }
  });

  return {
    filter,
    getSnapshot: () => snapshot,
    setValue(path, value) {
      // 使用 Formily Form 的 setValuesIn 方法
      filter.form.setValuesIn(path, value);
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      listeners.clear();
      unsubscribe();
    },
  };
}
