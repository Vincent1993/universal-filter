import type {
  Draft,
  Plugin,
  FilterApi,
  PluginFactory,
  PluginDisposeError,
} from '../types';
import type { FilterHooks } from '../hooks';
import { observable } from '@formily/reactive';

/**
 * 插件状态存储（响应式）
 */
export interface PluginState {
  [key: string]: unknown;
}

interface PluginInfo<TDraft extends Draft> {
  plugin: Plugin<TDraft>;
  state: PluginState;
}

/**
 * 插件公开信息（对外暴露）
 */
export interface PluginPublicInfo<TDraft extends Draft = Draft> {
  name: string;
  plugin: Plugin<TDraft>;
  state: PluginState;
  ready: boolean;
  error?: unknown;
}

/**
 * @name 插件管理器
 *
 * @description 负责插件的注册、初始化、生命周期管理和状态维护。
 * 通过 FilterHooks（tapable）与其他模块通信。
 *
 * 插件不再通过隐式鸭子类型（plugin.onDraftChange 等）注册生命周期，
 * 而是在 onInit 中通过 filter.hooks.xxx.tap() 显式注册。
 */
export class PluginManager<TDraft extends Draft> {
  private plugins: Plugin<TDraft>[] = [];
  private readonly pluginReady = new Map<
    string,
    { ready: boolean; error?: unknown }
  >();
  private readonly pluginMap = new Map<string, PluginInfo<TDraft>>();

  constructor(
    private hooks: FilterHooks<TDraft>,
    instancePlugins: PluginFactory<TDraft>[],
    globalPlugins: PluginFactory<TDraft>[],
    mergeStrategy: 'prepend' | 'append',
    filterApi: FilterApi<TDraft>
  ) {
    const allFactories = this.mergePluginFactories(
      instancePlugins,
      globalPlugins,
      mergeStrategy
    );
    const plugins = this.resolvePluginFactories(allFactories, filterApi);
    this.initializePluginMap(plugins);
    void this.runInit(filterApi);
    // 不再有 setupLifecycleListeners()
    // 插件在 onInit 中自行通过 filter.hooks.xxx.tap() 注册
  }

  protected mergePluginFactories(
    instancePlugins: PluginFactory<TDraft>[],
    globalPlugins: PluginFactory<TDraft>[],
    mergeStrategy: 'prepend' | 'append'
  ): PluginFactory<TDraft>[] {
    return mergeStrategy === 'prepend'
      ? [...instancePlugins, ...globalPlugins]
      : [...globalPlugins, ...instancePlugins];
  }

  protected resolvePluginFactories(
    factories: PluginFactory<TDraft>[],
    filterApi: FilterApi<TDraft>
  ): Plugin<TDraft>[] {
    const plugins: Plugin<TDraft>[] = [];
    const helpers = {
      root: filterApi,
      push: (plugin: Plugin<TDraft>) => plugins.push(plugin),
      shift: (plugin: Plugin<TDraft>) => plugins.unshift(plugin),
      remove: (pluginName: string) => {
        const index = plugins.findIndex(p => p.name === pluginName);
        if (index !== -1) plugins.splice(index, 1);
      }
    };

    for (const factory of factories) {
      if (typeof factory === 'function') {
        const result = factory(helpers);
        if (result) plugins.push(result);
      } else {
        plugins.push(factory);
      }
    }
    return plugins;
  }

  protected initializePluginMap(plugins: Plugin<TDraft>[]): void {
    this.plugins = plugins;
    this.pluginMap.clear();
    this.pluginReady.clear();

    for (const plugin of this.plugins) {
      const state = observable({} as PluginState);
      this.pluginMap.set(plugin.name, { plugin, state });
      this.pluginReady.set(plugin.name, { ready: false });
    }
  }

  markReady(pluginName: string, ready: boolean, error?: unknown): void {
    this.pluginReady.set(pluginName, { ready, error });
    this.hooks.pluginReady.call({ name: pluginName, ready, error });
  }

  isReady(pluginName: string): boolean {
    return this.pluginReady.get(pluginName)?.ready === true;
  }

  async runInit(filter: FilterApi<TDraft>): Promise<void> {
    this.hooks.pluginsAttached.call({ total: this.plugins.length });

    for (const plugin of this.plugins) {
      if (typeof plugin.onInit === 'function') {
        try {
          await plugin.onInit({ filter, pluginManager: this });
        } catch (error) {
          console.error('[PluginManager] onInit failed:', error);
          this.markReady(plugin.name, false, error);
        }
      } else {
        this.markReady(plugin.name, true);
      }
    }
    this.hooks.pluginsReady.call({ ready: this.ready });
  }

  dispose(): { errors: PluginDisposeError[] } {
    const errors: PluginDisposeError[] = [];
    for (const plugin of this.plugins) {
      if (typeof plugin.onDestroy === 'function') {
        try {
          plugin.onDestroy();
        } catch (error) {
          errors.push({ name: plugin.name, error });
        }
      }
    }
    this.plugins = [];
    this.pluginMap.clear();
    this.pluginReady.clear();
    this.hooks.pluginsDestroyed.call({ errors });
    return { errors };
  }

  get ready(): boolean {
    return Array.from(this.pluginReady.values()).every(({ ready }) => ready);
  }

  setState<T = Record<string, unknown>>(
    pluginName: string,
    state: T | ((prev: T | undefined) => T)
  ): void {
    const pluginInfo = this.pluginMap.get(pluginName);
    if (!pluginInfo) return;
    const pluginState = pluginInfo.state;
    if (typeof state === 'function') {
      const updater = state as (prev: T | undefined) => T;
      Object.assign(pluginState, updater(pluginState as T | undefined));
    } else {
      Object.assign(pluginState, state);
    }
  }

  getState<T = Record<string, unknown>>(pluginName: string): T | undefined {
    return this.pluginMap.get(pluginName)?.state as T | undefined;
  }

  get(pluginName: string): PluginPublicInfo<TDraft> | undefined {
    const pluginInfo = this.pluginMap.get(pluginName);
    if (!pluginInfo) return undefined;
    const readyInfo = this.pluginReady.get(pluginName);
    return {
      name: pluginName,
      plugin: pluginInfo.plugin,
      state: pluginInfo.state,
      ready: readyInfo?.ready ?? false,
      error: readyInfo?.error,
    };
  }

  has(pluginName: string): boolean {
    return this.pluginMap.has(pluginName);
  }

  list(): string[] {
    return Array.from(this.pluginMap.keys());
  }
}
