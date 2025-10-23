import type { Draft, FilterApi, FilterOptions, Plugin } from './types';
import EventEmitter from 'eventemitter3';
import { CoreManager, PluginManager } from './managers';
import { mergePlugins } from './lifecycle';
import { getGlobalConfigure } from '../context/configure';

/**
 * FilterController 核心控制器
 * 继承 CoreManager,组合 PluginManager 等模块
 * 通过内部事件总线协调模块间通信
 */
export class FilterController<TDraft extends Draft> extends CoreManager<TDraft> {
  // ============== 内部事件总线 ==============
  private readonly _bus = new EventEmitter();

  // ============== 模块命名空间 ==============
  readonly plugin: PluginManager<TDraft>;

  constructor(optionsConfig: FilterOptions<TDraft> = {}) {
    // 1. 合并插件配置(全局 + 实例)
    const configure = getGlobalConfigure<TDraft>();
    const defaults = configure.defaults ?? {};
    const strategy = configure.mergeStrategy?.plugins ?? 'append';
    const mergedPlugins = mergePlugins(
      (defaults.plugins ?? []) as Plugin<TDraft>[],
      (optionsConfig.plugins ?? []) as Plugin<TDraft>[],
      strategy
    );

    // 2. 创建 CoreManager (传入 emitFn)
    super({
      ...optionsConfig,
      emitFn: (event, payload) => this._bus.emit(event, payload),
    });

    // 3. 实例化 PluginManager (传入 bus 和插件列表)
    this.plugin = new PluginManager(this._bus, mergedPlugins);

    // 4. 初始化 CoreManager effects (现在 _bus 已就绪)
    this.initializeEffects();

    // 5. 调用用户的 onInit 监听器
    this.listeners?.onInit?.({ root: this });

    // 6. 启动插件初始化
    void this.plugin.runInit(this as FilterApi<TDraft>);

    // 7. autoApply 逻辑
    if (optionsConfig.autoApply?.onInit) {
      this._bus.once('plugins:ready', ({ ready }) => {
        if (ready) void this.apply();
      });
      if (this.plugin.count === 0) {
        queueMicrotask(() => void this.apply());
      }
    }
  }
}
