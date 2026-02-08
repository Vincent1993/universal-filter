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
 * @name 插件管理器
 *
 * @description 负责插件的注册、初始化、生命周期管理和状态维护
 * 通过 FilterHooks（tapable）与其他模块通信，替代了原来的 EventEmitter
 *
 * @template TDraft - 筛选器数据类型
 */
/**
 * 插件状态存储（响应式）
 */
export interface PluginState {
  [key: string]: unknown;
}

/**
 * 插件信息存储结构（内部使用）
 */
interface PluginInfo<TDraft extends Draft> {
  plugin: Plugin<TDraft>;
  state: PluginState;
}

/**
 * 插件公开信息（对外暴露）
 */
export interface PluginPublicInfo<TDraft extends Draft = Draft> {
  /** 插件名称 */
  name: string;
  /** 插件实例 */
  plugin: Plugin<TDraft>;
  /** 插件响应式状态（可用于 UI 绑定） */
  state: PluginState;
  /** 插件是否就绪 */
  ready: boolean;
  /** 插件初始化错误（如果有） */
  error?: unknown;
}

export class PluginManager<TDraft extends Draft> {
  private plugins: Plugin<TDraft>[] = [];
  private readonly pluginReady = new Map<
    string,
    { ready: boolean; error?: unknown }
  >();
  /** 插件映射表：存储插件实例和状态 */
  private readonly pluginMap = new Map<string, PluginInfo<TDraft>>();

  constructor(
    private hooks: FilterHooks<TDraft>,
    instancePlugins: PluginFactory<TDraft>[],
    globalPlugins: PluginFactory<TDraft>[],
    mergeStrategy: 'prepend' | 'append',
    filterApi: FilterApi<TDraft>
  ) {
    // Phase 1: 合并全局插件和实例插件
    const allFactories = this.mergePluginFactories(
      instancePlugins,
      globalPlugins,
      mergeStrategy
    );

    // Phase 2: 解析插件工厂函数
    const plugins = this.resolvePluginFactories(allFactories, filterApi);

    // Phase 3: 存储插件并初始化映射
    this.initializePluginMap(plugins);

    // Phase 4: 自动初始化插件
    void this.runInit(filterApi);

    // Phase 5: 注册生命周期钩子监听器
    this.setupLifecycleListeners();
  }

  /**
   * @name setupLifecycleListeners
   * @description 注册插件生命周期钩子监听器
   * 使用 tapable hooks 替代 EventEmitter 监听
   * @private
   */
  private setupLifecycleListeners(): void {
    // 监听 draftChange
    this.hooks.draftChange.tap('PluginManager:draftChange', (payload) => {
      this.plugins.forEach((plugin) => {
        (plugin as any).onDraftChange?.(payload.draft, payload.prev);
      });
    });

    // 监听 applyStart
    this.hooks.applyStart.tap('PluginManager:applyStart', (payload) => {
      this.plugins.forEach((plugin) => {
        (plugin as any).onApplyStart?.(payload);
      });
    });

    // 监听 applySuccess
    this.hooks.applySuccess.tap('PluginManager:applySuccess', (payload) => {
      this.plugins.forEach((plugin) => {
        (plugin as any).onApplySuccess?.(payload);
      });
    });

    // 监听 validateFailed
    this.hooks.validateFailed.tap('PluginManager:validateFailed', (payload) => {
      this.plugins.forEach((plugin) => {
        (plugin as any).onValidateFailed?.(payload);
      });
    });

    // 监听 reset
    this.hooks.reset.tap('PluginManager:reset', (payload) => {
      this.plugins.forEach((plugin) => {
        (plugin as any).onReset?.(payload);
      });
    });
  }

  /**
   * @name mergePluginFactories
   * @description 合并全局插件和实例插件工厂函数
   * @protected
   */
  protected mergePluginFactories(
    instancePlugins: PluginFactory<TDraft>[],
    globalPlugins: PluginFactory<TDraft>[],
    mergeStrategy: 'prepend' | 'append'
  ): PluginFactory<TDraft>[] {
    return mergeStrategy === 'prepend'
      ? [...instancePlugins, ...globalPlugins]
      : [...globalPlugins, ...instancePlugins];
  }

  /**
   * @name resolvePluginFactories
   * @description 解析插件工厂函数，将工厂函数转换为插件实例
   * @protected
   */
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
        if (index !== -1) {
          plugins.splice(index, 1);
        }
      }
    };

    for (const factory of factories) {
      if (typeof factory === 'function') {
        const result = factory(helpers);
        if (result) {
          plugins.push(result);
        }
      } else {
        plugins.push(factory);
      }
    }

    return plugins;
  }

  /**
   * @name initializePluginMap
   * @description 初始化插件映射表和就绪状态
   * @protected
   */
  protected initializePluginMap(plugins: Plugin<TDraft>[]): void {
    this.plugins = plugins;
    this.pluginMap.clear();
    this.pluginReady.clear();

    for (const plugin of this.plugins) {
      // 初始化响应式状态对象
      const state = observable({} as PluginState);
      this.pluginMap.set(plugin.name, {
        plugin,
        state,
      });
      this.pluginReady.set(plugin.name, { ready: false });
    }
  }

  /**
   * @name markReady
   * @description 标记插件就绪状态（供插件内部调用）
   * @internal
   */
  markReady(pluginName: string, ready: boolean, error?: unknown): void {
    this.pluginReady.set(pluginName, { ready, error });
    this.hooks.pluginReady.call({ name: pluginName, ready, error });
  }

  /**
   * @name isReady
   * @description 检查指定插件是否就绪
   */
  isReady(pluginName: string): boolean {
    return this.pluginReady.get(pluginName)?.ready === true;
  }

  /**
   * @name runInit
   * @description 执行所有插件的初始化钩子
   * @internal
   */
  async runInit(filter: FilterApi<TDraft>): Promise<void> {
    // 发送插件挂载事件
    this.hooks.pluginsAttached.call({ total: this.plugins.length });

    // 按照插件注册顺序执行初始化
    for (const plugin of this.plugins) {
      if (typeof plugin.onInit === 'function') {
        try {
          await plugin.onInit({
            filter,
            pluginManager: this,
          });
          // 注意：markReady 的调用应该由插件自己决定，通过 pluginManager.markReady 调用
        } catch (error) {
          console.error('[PluginManager] onInit failed:', error);
          // 如果初始化过程中抛出异常，标记为未就绪
          this.markReady(plugin.name, false, error);
        }
      } else {
        // 没有 onInit 的插件，默认标记为就绪
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


  /**
   * @name ready
   * @description 所有插件是否都已就绪
   */
  get ready(): boolean {
    return Array.from(this.pluginReady.values()).every(({ ready }) => ready);
  }

  /**
   * @name setState
   * @description 设置指定插件的状态（响应式）
   * @internal
   */
  setState<T = Record<string, unknown>>(
    pluginName: string,
    state: T | ((prev: T | undefined) => T)
  ): void {
    const pluginInfo = this.pluginMap.get(pluginName);
    if (!pluginInfo) {
      return;
    }

    const pluginState = pluginInfo.state;
    if (typeof state === 'function') {
      const updater = state as (prev: T | undefined) => T;
      const prevState = pluginState as T | undefined;
      const newState = updater(prevState);
      // 使用 Object.assign 更新 observable 对象的属性，保持响应式
      Object.assign(pluginState, newState);
    } else {
      // 直接合并状态对象
      Object.assign(pluginState, state);
    }
  }

  /**
   * @name getState
   * @description 获取指定插件的状态
   * @internal
   */
  getState<T = Record<string, unknown>>(pluginName: string): T | undefined {
    return this.pluginMap.get(pluginName)?.state as T | undefined;
  }

  /**
   * @name get
   * @description 获取指定插件的公开信息
   */
  get(pluginName: string): PluginPublicInfo<TDraft> | undefined {
    const pluginInfo = this.pluginMap.get(pluginName);
    if (!pluginInfo) {
      return undefined;
    }

    const readyInfo = this.pluginReady.get(pluginName);
    return {
      name: pluginName,
      plugin: pluginInfo.plugin,
      state: pluginInfo.state,
      ready: readyInfo?.ready ?? false,
      error: readyInfo?.error,
    };
  }

  /**
   * @name has
   * @description 检查指定插件是否已注册
   */
  has(pluginName: string): boolean {
    return this.pluginMap.has(pluginName);
  }

  /**
   * @name list
   * @description 获取所有已注册插件的名称列表
   */
  list(): string[] {
    return Array.from(this.pluginMap.keys());
  }
}
