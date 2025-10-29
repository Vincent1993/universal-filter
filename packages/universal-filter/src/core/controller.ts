import type {
  Draft,
  FilterApi,
  FilterEventMap,
  FilterOptions,
  PluginFactory,
} from './types';
import EventEmitter from 'eventemitter3';
import { CoreManager, PluginManager } from './managers';
import { getGlobalConfigure } from '../context';

/**
 * FilterController 核心控制器
 * 继承 CoreManager,组合 PluginManager 等模块
 * 通过内部事件总线协调模块间通信
 */
export class FilterController<TDraft extends Draft>
  extends CoreManager<TDraft>
  implements FilterApi<TDraft>
{
  // ============== 内部事件总线 ==============
  readonly _bus = new EventEmitter<FilterEventMap<TDraft>>();

  private disposed = false;

  // ============== 模块命名空间 ==============
  readonly plugin: PluginManager<TDraft>;

  constructor(optionsConfig: FilterOptions<TDraft> = {}) {
    // 1. 获取全局配置和插件
    const configure = getGlobalConfigure<TDraft>();
    const globalPlugins = (configure.defaults?.plugins ?? []) as PluginFactory<TDraft>[];
    const instancePlugins = (optionsConfig.plugins ?? []) as PluginFactory<TDraft>[];
    const strategy = configure.mergeStrategy?.plugins ?? 'append';

    // 2. 创建 CoreManager (传入 emitFn)
    super({
      ...optionsConfig,
      emitFn: (event, payload) => this._bus.emit(event, payload),
    });

    // 3. 实例化 PluginManager (传入插件和策略，自动合并和初始化)
    this.plugin = new PluginManager(
      this._bus,
      instancePlugins,
      globalPlugins,
      strategy,
      this as FilterApi<TDraft>
    );

    // 5. 调用用户的 onInit 监听器
    this.listeners?.onInit?.({ root: this });

    // 注意：插件初始化已在 PluginManager 构造函数中自动启动

    // 6. autoApply 逻辑
    if (optionsConfig.autoApply?.onInit) {
      this._bus.once('plugins:ready', ({ ready }) => {
        if (ready) queueMicrotask(() => void this.apply());
      });
    }
    // 7. autoApply 逻辑
    if (optionsConfig.autoApply?.onChange) {
      this._bus.on('draft:change', () => queueMicrotask(() => void this.apply()));
    }
  }

  on<K extends keyof FilterEventMap<TDraft>>(
    event: K,
    listener: (payload: FilterEventMap<TDraft>[K]) => void
  ): () => void {
    this._bus.on(event, listener);
    return () => this.off(event, listener);
  }

  once<K extends keyof FilterEventMap<TDraft>>(
    event: K,
    listener: (payload: FilterEventMap<TDraft>[K]) => void
  ): () => void {
    this._bus.once(event, listener);
    return () => this.off(event, listener);
  }

  off<K extends keyof FilterEventMap<TDraft>>(
    event: K,
    listener: (payload: FilterEventMap<TDraft>[K]) => void
  ): void {
    this._bus.off(event, listener);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.plugin.dispose();

    this.listeners?.onDestroy?.({ root: this });
    this._bus.emit('destroy', {});
    this._bus.removeAllListeners();
  }
}
