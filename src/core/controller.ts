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
import { define, observable, action } from '@formily/reactive';
import { onFormMount } from '@formily/core';

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

  // 定义响应式属性
  ready = false;

  // 私有状态追踪（不需要响应式，仅内部逻辑使用）
  private _isFormMounted = false;
  private _arePluginsReady = false;
  private _optionsConfig: FilterOptions<TDraft>;

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

    // 保存 optionsConfig 供后续使用
    this._optionsConfig = optionsConfig;

    // 3. 定义响应式模型
    this.makeControllerObservable();

    // 4. 设置状态检查（先注册监听器，防止错过 PluginManager 的事件）
    this.setupReadyCheck(optionsConfig);

    // 5. 实例化 PluginManager (传入插件和策略，自动合并和初始化)
    this.plugin = new PluginManager(
      this._bus,
      instancePlugins,
      globalPlugins,
      strategy,
      this as FilterApi<TDraft>
    );

    // 6. 调用用户的 onInit 监听器
    this.listeners?.onInit?.({ root: this });

    // 注意：插件初始化已在 PluginManager 构造函数中自动启动

    // 7. autoApply 逻辑 (onInit 已在 checkReadyState 中处理)
    // 兼容逻辑：如果 ready 已经为 true (同步插件的情况)，checkReadyState 会直接触发 apply

    // 8. autoApply 逻辑 (onChange)
    if (optionsConfig.autoApply?.onChange) {
      this._bus.on('draft:change', () => queueMicrotask(() => void this.apply()));
    }
  }

  protected makeControllerObservable() {
    define(this, {
      ready: observable.ref, // 使用 ref 即可，布尔值
      setReady: action // 定义一个 action 来修改状态
    });
  }

  // 内部使用的 action
  setReady(ready: boolean) {
    this.ready = ready;
  }

  private setupReadyCheck(optionsConfig: FilterOptions<TDraft>) {
    // 监听插件就绪
    this._bus.on('plugins:ready', ({ ready }) => {
      this._arePluginsReady = ready;
      this.checkReadyState(); // 使用保存的 _optionsConfig
    });

    // 监听表单挂载
    this.form.addEffects('controller-ready-check', () => {
      onFormMount(() => {
        this._isFormMounted = true;
        this.checkReadyState(); // 使用保存的 _optionsConfig
      });
    });
  }

  private checkReadyState(optionsConfig?: FilterOptions<TDraft>) {
    // 如果没有传入 optionsConfig，使用保存的配置
    const config = optionsConfig || this._optionsConfig;

    // 检查是否都满足，且 ready 状态尚未为 true
    if (this._isFormMounted && this._arePluginsReady && !this.ready) {
      // 更新响应式状态
      this.setReady(true);

      // 触发事件（为了兼容旧逻辑或外部副作用）
      this._bus.emit('ready', { root: this });

      // 处理 autoApply.onInit
      if (config?.autoApply?.onInit) {
        void this.apply();
      }
    }
  }

  on<K extends keyof FilterEventMap<TDraft>>(
    event: K,
    listener: (payload: FilterEventMap<TDraft>[K]) => void
  ): () => void {
    this._bus.on(event, listener as any);
    return () => this.off(event, listener);
  }

  once<K extends keyof FilterEventMap<TDraft>>(
    event: K,
    listener: (payload: FilterEventMap<TDraft>[K]) => void
  ): () => void {
    this._bus.once(event, listener as any);
    return () => this.off(event, listener);
  }

  off<K extends keyof FilterEventMap<TDraft>>(
    event: K,
    listener: (payload: FilterEventMap<TDraft>[K]) => void
  ): void {
    this._bus.off(event, listener as any);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    const listeners = this.listeners;

    this.plugin.dispose();
    super.dispose();

    listeners?.onDestroy?.({ root: this });
    this._bus.emit('destroy', {});
    this._bus.removeAllListeners();
  }
}
