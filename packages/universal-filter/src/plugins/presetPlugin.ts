import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { cloneDeep } from 'es-toolkit';
import type {
  Draft,
  FilterPreset,
  PresetPluginOptions,
  PresetPluginState,
  PresetStorage,
  UseFilterPresetsOptions,
  UseFilterPresetsResult,
} from '../core/types';
import type { Plugin } from '../core/types';
import { useFilter } from '../hooks/useFilter';
import { ERROR_CODES, FilterError } from '../core/errors';

const DEFAULT_PRESET_KEY = Symbol('preset-plugin');

class NamespacedMemoryPresetStorage<TDraft extends Draft> implements PresetStorage<TDraft> {
  private readonly namespaces = new Map<string, Map<string, FilterPreset<TDraft>>>();
  private readonly listeners = new Map<string, Set<() => void>>();

  list(namespace: string): FilterPreset<TDraft>[] {
    const map = this.ensureNamespace(namespace);
    return Array.from(map.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((preset) => cloneDeep(preset));
  }

  get(namespace: string, id: string): FilterPreset<TDraft> | undefined {
    const map = this.ensureNamespace(namespace);
    const preset = map.get(id);
    return preset ? cloneDeep(preset) : undefined;
  }

  save(namespace: string, preset: FilterPreset<TDraft>): void {
    const map = this.ensureNamespace(namespace);
    map.set(preset.id, cloneDeep(preset));
    this.notify(namespace);
  }

  remove(namespace: string, id: string): void {
    const map = this.ensureNamespace(namespace);
    if (map.delete(id)) {
      this.notify(namespace);
    }
  }

  subscribe(namespace: string, listener: () => void): () => void {
    const set = this.ensureListeners(namespace);
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  private ensureNamespace(namespace: string) {
    let bucket = this.namespaces.get(namespace);
    if (!bucket) {
      bucket = new Map();
      this.namespaces.set(namespace, bucket);
    }
    return bucket;
  }

  private ensureListeners(namespace: string) {
    let set = this.listeners.get(namespace);
    if (!set) {
      set = new Set();
      this.listeners.set(namespace, set);
    }
    return set;
  }

  private notify(namespace: string) {
    const listeners = this.listeners.get(namespace);
    if (!listeners) return;
    for (const listener of listeners) {
      listener();
    }
  }
}

const globalPresetStorage = new NamespacedMemoryPresetStorage<Record<string, unknown>>();

// WeakMap to store plugin state keyed by FilterApi instance
const pluginStateMap = new WeakMap<any, PresetPluginState<any>>();

export function createMemoryPresetStorage<TDraft extends Draft>(): PresetStorage<TDraft> {
  return new NamespacedMemoryPresetStorage<TDraft>();
}

export function createPresetPlugin<TDraft extends Draft = Draft>(
  options: PresetPluginOptions<TDraft> = {}
): Plugin<TDraft> {
  const key = options.key ?? DEFAULT_PRESET_KEY;
  const storage = (options.storage ?? globalPresetStorage) as PresetStorage<TDraft>;
  const initialPresets = options.initialPresets?.map((preset) => cloneDeep(preset)) ?? [];

  return {
    name: 'preset-plugin',
    onInit({ root, setReady }) {
      const namespace = options.namespace ?? root.id;
      const state: PresetPluginState<TDraft> = { storage, namespace, key };
      // Store state in WeakMap instead of on FilterApi
      pluginStateMap.set(root, state);
      for (const preset of initialPresets) {
        storage.save(namespace, { ...preset, updatedAt: preset.updatedAt ?? Date.now() });
      }
      setReady(true);
    },
    onDestroy() {
      // WeakMap entries are automatically cleaned up when FilterApi is garbage collected
    },
  };
}

// Helper function to get plugin state
function getPluginState<TDraft extends Draft = Draft>(
  filterApi: any,
  pluginKey: symbol | string = DEFAULT_PRESET_KEY
): PresetPluginState<TDraft> | undefined {
  return pluginStateMap.get(filterApi);
}

export function useFilterPresets<TDraft extends Draft = Draft>(
  options?: UseFilterPresetsOptions<TDraft>
): UseFilterPresetsResult<TDraft> {
  const filter = useFilter(options);
  const pluginKey = options?.pluginKey ?? DEFAULT_PRESET_KEY;
  const state = getPluginState<TDraft>(filter, pluginKey);

  if (!state) {
    throw new FilterError(ERROR_CODES.PLUGIN_NOT_FOUND, 'Preset plugin is not installed');
  }

  const subscribe = useCallback(
    (listener: () => void) => {
      return state.storage.subscribe?.(state.namespace, listener) ?? (() => {});
    },
    [state]
  );

  const getSnapshot = useCallback(
    () => state.storage.list(state.namespace),
    [state]
  );

  const presets = useSyncExternalStore(subscribe, getSnapshot);

  return useMemo(() => {
    const savePreset = (name: string, metadata?: Record<string, unknown>): FilterPreset<TDraft> => {
      const preset: FilterPreset<TDraft> = {
        id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        values: cloneDeep(filter.draft),
        metadata,
        updatedAt: Date.now(),
      };
      state.storage.save(state.namespace, preset);
      return preset;
    };

    const applyPreset = async (id: string): Promise<void> => {
      const preset = state.storage.get(state.namespace, id);
      if (!preset) {
        throw new FilterError(ERROR_CODES.PRESET_NOT_FOUND, `Preset "${id}" not found`);
      }
      filter.load(preset.values, { mode: 'replace', decode: false });
      options?.onApply?.(preset);
      await filter.apply();
    };

    const removePreset = (id: string): void => {
      state.storage.remove(state.namespace, id);
    };

    const renamePreset = (id: string, name: string): void => {
      const preset = state.storage.get(state.namespace, id);
      if (preset) {
        preset.name = name;
        preset.updatedAt = Date.now();
        state.storage.save(state.namespace, preset);
      }
    };

    const overwritePreset = (id: string, updater: Partial<FilterPreset<TDraft>>): FilterPreset<TDraft> | undefined => {
      const preset = state.storage.get(state.namespace, id);
      if (preset) {
        const updated = {
          ...preset,
          ...updater,
          updatedAt: Date.now(),
        };
        state.storage.save(state.namespace, updated);
        return updated;
      }
      return undefined;
    };

    return { presets, savePreset, applyPreset, removePreset, renamePreset, overwritePreset };
  }, [filter, state, options]);
}

export const PRESET_PLUGIN_KEY = DEFAULT_PRESET_KEY;
