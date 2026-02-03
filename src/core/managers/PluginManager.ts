import type {
  Draft,
  Plugin,
  FilterApi,
  PluginFactory,
  PluginDisposeError,
  FilterEventMap,
} from '../types';
import type EventEmitter from 'eventemitter3';
import { observable, define } from '@formily/reactive';

/**
 * @name 插件管理器
 *
 * @description 负责插件的注册、初始化、生命周期管理和状态维护
 * 通过内部事件总线与其他模块通信
 *
 * @template TDraft - 筛选器数据类型
 *
 * @example
 * ```ts
 * // 检查插件是否就绪
 * if (filter.plugin.ready) {
 *   console.log('所有插件已就绪');
 * }
 * ```
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
    private bus: EventEmitter<FilterEventMap<TDraft>>,
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
   * @private
   */
  private setupLifecycleListeners(): void {
    // 监听 draft:change
    this.bus.on('draft:change', (payload) => {
      this.plugins.forEach((plugin) => {
        plugin.onDraftChange?.(payload.draft, payload.prev);
      });
    });

    // 监听 apply:start
    this.bus.on('apply:start', (payload) => {
      this.plugins.forEach((plugin) => {
        plugin.onApplyStart?.(payload);
      });
    });

    // 监听 apply:success
    this.bus.on('apply:success', (payload) => {
      this.plugins.forEach((plugin) => {
        plugin.onApplySuccess?.(payload);
      });
    });

    // 监听 validate:failed
    this.bus.on('validate:failed', (payload) => {
      this.plugins.forEach((plugin) => {
        plugin.onValidateFailed?.(payload);
      });
    });

    // 监听 reset
    this.bus.on('reset', (payload) => {
      this.plugins.forEach((plugin) => {
        plugin.onReset?.(payload);
      });
    });
  }

  /**
   * @name mergePluginFactories
   * @description 合并全局插件和实例插件工厂函数
   * @param instancePlugins - 实例插件工厂函数列表
   * @param globalPlugins - 全局插件工厂函数列表
   * @param mergeStrategy - 合并策略：'prepend' 表示实例插件在前，'append' 表示全局插件在前
   * @returns 合并后的插件工厂函数列表
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
   * @param factories - 插件工厂函数列表
   * @param filterApi - FilterApi 实例，用于传递给工厂函数
   * @returns 解析后的插件实例列表
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
   * @param plugins - 插件实例列表
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
   * @param pluginName - 插件名称
   * @param ready - 是否就绪
   * @param error - 错误信息（可选）
   * @internal
   */
  markReady(pluginName: string, ready: boolean, error?: unknown): void {
    // console.log(`[PluginManager] markReady: ${pluginName} = ${ready}`);
    this.pluginReady.set(pluginName, { ready, error });
    this.bus.emit('plugin:ready', { name: pluginName, ready, error });
  }

  /**
   * @name isReady
   * @description 检查指定插件是否就绪
   * @param pluginName - 插件名称
   * @returns 是否就绪
   */
  isReady(pluginName: string): boolean {
    return this.pluginReady.get(pluginName)?.ready === true;
  }

  /**
   * @name runInit
   * @description 执行所有插件的初始化钩子
   * @param filter - FilterApi 实例
   * @internal
   */
  async runInit(filter: FilterApi<TDraft>): Promise<void> {
    // 发送插件挂载事件
    this.bus.emit('plugins:attached', { total: this.plugins.length });

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
    this.bus.emit('plugins:ready', { ready: this.ready });
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

    this.bus.emit('plugins:destroyed', { errors });

    return { errors };
  }


  /**
   * @name ready
   * @description 所有插件是否都已就绪
   * @type {boolean}
   * @readonly
   */
  get ready(): boolean {
    return Array.from(this.pluginReady.values()).every(({ ready }) => ready);
  }

  /**
   * @name setState
   * @description 设置指定插件的状态（响应式）
   * @param pluginName - 插件名称
   * @param state - 状态对象或更新函数
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
   * @param pluginName - 插件名称
   * @returns 插件的状态对象
   * @internal
   */
  getState<T = Record<string, unknown>>(pluginName: string): T | undefined {
    return this.pluginMap.get(pluginName)?.state as T | undefined;
  }

  /**
   * @name get
   * @description 获取指定插件的公开信息（包含插件实例、响应式状态、就绪状态）
   * @param pluginName - 插件名称
   * @returns 插件公开信息，如果插件不存在则返回 undefined
   *
   * @example
   * ```ts
   * // 获取 codec 插件信息
   * const codecInfo = filter.plugin.get('codec-plugin');
   * if (codecInfo) {
   *   console.log('插件就绪:', codecInfo.ready);
   *   console.log('转换状态:', codecInfo.state.transformState);
   * }
   * ```
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
   * @param pluginName - 插件名称
   * @returns 是否存在该插件
   */
  has(pluginName: string): boolean {
    return this.pluginMap.has(pluginName);
  }

  /**
   * @name list
   * @description 获取所有已注册插件的名称列表
   * @returns 插件名称数组
   */
  list(): string[] {
    return Array.from(this.pluginMap.keys());
  }

}
