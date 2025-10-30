import type {
  Draft,
  Plugin,
  FilterApi,
  PluginFactory,
  PluginDisposeError,
  FilterEventMap,
} from '../types';
import type EventEmitter from 'eventemitter3';

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
export class PluginManager<TDraft extends Draft> {
  private plugins: Plugin<TDraft>[] = [];
  private readonly pluginReady = new Map<
    string,
    { ready: boolean; error?: unknown }
  >();
  private readonly pluginMap = new Map<string, Plugin<TDraft>>();

  constructor(
    private bus: EventEmitter<FilterEventMap<TDraft>>,
    instancePlugins: PluginFactory<TDraft>[],
    globalPlugins: PluginFactory<TDraft>[],
    mergeStrategy: 'prepend' | 'append',
    filterApi: FilterApi<TDraft>
  ) {
    // Phase 1: 合并全局插件和实例插件
    const allFactories = mergeStrategy === 'prepend'
      ? [...instancePlugins, ...globalPlugins]
      : [...globalPlugins, ...instancePlugins];

    // Phase 2: 解析插件工厂函数
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

    for (const factory of allFactories) {
      if (typeof factory === 'function') {
        const result = factory(helpers);
        if (result) {
          plugins.push(result);
        }
      } else {
        plugins.push(factory);
      }
    }

    // Phase 3: 存储插件并初始化映射
    this.plugins = plugins;
    this.pluginMap.clear();
    this.pluginReady.clear();
    for (const p of this.plugins) {
      this.pluginMap.set(p.name, p);
      this.pluginReady.set(p.name, { ready: false });
    }

    // Phase 4: 自动初始化插件
    void this.runInit(filterApi);
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
      let invoked = false;
      const markReady = (ready: boolean, error?: unknown) => {
        invoked = true;
        this.pluginReady.set(plugin.name, { ready, error });
        this.bus.emit('plugin:ready', { name: plugin.name, ready, error });
      };

      if (typeof plugin.onInit === 'function') {
        try {
          await plugin.onInit({
            root: filter,
            setReady: markReady,
            bus: this.bus,
            isReady: () => this.pluginReady.get(plugin.name)?.ready === true,
          });
        } catch (error) {
          markReady(false, error);
          continue;
        }

        if (!invoked) {
          markReady(true);
        }
      } else {
        markReady(true);
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
}
