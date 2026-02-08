import type {
  Draft,
  FilterApi,
  FilterEventMap,
  FilterOptions,
  PluginFactory,
  EventToHookName,
} from './types';
import { CoreManager, PluginManager } from './managers';
import { getGlobalConfigure } from '../context';
import { define, observable, action } from '@formily/reactive';
import { onFormMount } from '@formily/core';
import type { FilterHooks } from './hooks';

/**
 * 事件名 → hook 名的运行时映射表
 * 用于 on/off/once 方法将旧式事件名路由到对应的 tapable hook
 */
const EVENT_TO_HOOK: Record<string, string> = {
  'init': 'init',
  'draft:change': 'draftChange',
  'apply:start': 'applyStart',
  'apply:success': 'applySuccess',
  'validate:failed': 'validateFailed',
  'reset': 'reset',
  'plugin:ready': 'pluginReady',
  'plugins:ready': 'pluginsReady',
  'plugins:attached': 'pluginsAttached',
  'plugins:destroyed': 'pluginsDestroyed',
  'destroy': 'destroy',
  'ready': 'ready',
};

/**
 * FilterController 核心控制器
 * 继承 CoreManager，组合 PluginManager 等模块
 * 通过 tapable hooks 作为唯一事件源协调模块间通信
 *
 * 替代了原来的三套事件机制：
 * 1. EventEmitter3 → hooks (tapable)
 * 2. FilterListeners 回调 → hooks taps（在 CoreManager 中注册）
 * 3. 自制 AsyncSeriesWaterfallHook → tapable AsyncSeriesWaterfallHook
 */
export class FilterController<TDraft extends Draft>
  extends CoreManager<TDraft>
  implements FilterApi<TDraft>
{
  private disposed = false;

  // ============== 模块命名空间 ==============
  readonly plugin: PluginManager<TDraft>;

  // 定义响应式属性
  ready = false;

  // 私有状态追踪（不需要响应式，仅内部逻辑使用）
  private _isFormMounted = false;
  private _arePluginsReady = false;
  private _optionsConfig: FilterOptions<TDraft>;

  // ============== on/off/once 支持 ==============
  /**
   * 用于追踪 listener → tap name 的映射
   * 这样 off() 可以通过 listener 引用找到对应的 tap 并移除
   */
  private _tapCounter = 0;
  private _tapMap = new Map<Function, { tapName: string; hookName: string }[]>();

  constructor(optionsConfig: FilterOptions<TDraft> = {}) {
    // 1. 获取全局配置和插件
    const configure = getGlobalConfigure<TDraft>();
    const globalPlugins = (configure.defaults?.plugins ?? []) as PluginFactory<TDraft>[];
    const instancePlugins = (optionsConfig.plugins ?? []) as PluginFactory<TDraft>[];
    const strategy = configure.mergeStrategy?.plugins ?? 'append';

    // 2. 创建 CoreManager（hooks 在 CoreManager 构造函数中创建）
    super(optionsConfig);

    // 保存 optionsConfig 供后续使用
    this._optionsConfig = optionsConfig;

    // 3. 定义响应式模型
    this.makeControllerObservable();

    // 4. 设置状态检查（先注册监听器，防止错过 PluginManager 的事件）
    this.setupReadyCheck(optionsConfig);

    // 5. 实例化 PluginManager（传入 hooks 而非 EventEmitter）
    this.plugin = new PluginManager(
      this.hooks,
      instancePlugins,
      globalPlugins,
      strategy,
      this as FilterApi<TDraft>
    );

    // 6. 调用用户的 onInit 钩子
    this.hooks.init.call({ root: this as FilterApi<TDraft> });

    // 7. autoApply 逻辑 (onChange)
    if (optionsConfig.autoApply?.onChange) {
      this.hooks.draftChange.tap('autoApply:onChange', () => {
        queueMicrotask(() => void this.apply());
      });
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
    // 监听插件就绪（通过 hooks）
    this.hooks.pluginsReady.tap('controller:readyCheck:plugins', ({ ready }) => {
      this._arePluginsReady = ready;
      this.checkReadyState();
    });

    // 监听表单挂载
    this.form.addEffects('controller-ready-check', () => {
      onFormMount(() => {
        this._isFormMounted = true;
        this.checkReadyState();
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

      // 通过 hooks 触发 ready 事件
      this.hooks.ready.call({ root: this as FilterApi<TDraft> });

      // 处理 autoApply.onInit
      if (config?.autoApply?.onInit) {
        void this.apply();
      }
    }
  }

  // ============== 公开事件 API（on/off/once）==============
  // 这些方法将旧式事件名路由到对应的 tapable hook，
  // 提供与 EventEmitter 兼容的订阅/取消订阅 API

  on<K extends keyof FilterEventMap<TDraft>>(
    event: K,
    listener: (payload: FilterEventMap<TDraft>[K]) => void
  ): () => void {
    const hookName = EVENT_TO_HOOK[event as string];
    if (!hookName) {
      console.warn(`[FilterController] Unknown event: ${String(event)}`);
      return () => {};
    }

    const hook = (this.hooks as any)[hookName];
    if (!hook) {
      console.warn(`[FilterController] Hook not found: ${hookName}`);
      return () => {};
    }

    const tapName = `__on_${this._tapCounter++}`;
    hook.tap(tapName, listener);

    // 追踪映射关系
    if (!this._tapMap.has(listener)) {
      this._tapMap.set(listener, []);
    }
    this._tapMap.get(listener)!.push({ tapName, hookName });

    return () => this.off(event, listener);
  }

  once<K extends keyof FilterEventMap<TDraft>>(
    event: K,
    listener: (payload: FilterEventMap<TDraft>[K]) => void
  ): () => void {
    const hookName = EVENT_TO_HOOK[event as string];
    if (!hookName) {
      console.warn(`[FilterController] Unknown event: ${String(event)}`);
      return () => {};
    }

    const hook = (this.hooks as any)[hookName];
    if (!hook) {
      console.warn(`[FilterController] Hook not found: ${hookName}`);
      return () => {};
    }

    const tapName = `__once_${this._tapCounter++}`;
    let fired = false;

    const wrappedListener = (payload: any) => {
      if (fired) return;
      fired = true;
      // 调用后立即移除 tap
      this._removeTap(hook, tapName);
      listener(payload);
    };

    hook.tap(tapName, wrappedListener);

    // 追踪映射关系（使用原始 listener 作为 key）
    if (!this._tapMap.has(listener)) {
      this._tapMap.set(listener, []);
    }
    this._tapMap.get(listener)!.push({ tapName, hookName });

    return () => {
      if (!fired) {
        this._removeTap(hook, tapName);
        this._removeFromTapMap(listener, tapName);
      }
    };
  }

  off<K extends keyof FilterEventMap<TDraft>>(
    event: K,
    listener: (payload: FilterEventMap<TDraft>[K]) => void
  ): void {
    const hookName = EVENT_TO_HOOK[event as string];
    if (!hookName) return;

    const entries = this._tapMap.get(listener);
    if (!entries) return;

    const hook = (this.hooks as any)[hookName];
    if (!hook) return;

    // 找到对应的 tap 并移除
    const matchIdx = entries.findIndex(e => e.hookName === hookName);
    if (matchIdx !== -1) {
      const entry = entries[matchIdx];
      this._removeTap(hook, entry.tapName);
      entries.splice(matchIdx, 1);
      if (entries.length === 0) {
        this._tapMap.delete(listener);
      }
    }
  }

  /**
   * 从 tapable hook 的内部 taps 数组中移除指定的 tap
   * @internal
   */
  private _removeTap(hook: any, tapName: string): void {
    if (hook.taps) {
      hook.taps = hook.taps.filter((t: any) => t.name !== tapName);
      // 重置编译缓存，使 tapable 重新编译 call 函数
      if (typeof hook._resetCompilation === 'function') {
        hook._resetCompilation();
      }
    }
  }

  /**
   * 从 _tapMap 中移除指定 tapName 的记录
   * @internal
   */
  private _removeFromTapMap(listener: Function, tapName: string): void {
    const entries = this._tapMap.get(listener);
    if (!entries) return;
    const idx = entries.findIndex(e => e.tapName === tapName);
    if (idx !== -1) {
      entries.splice(idx, 1);
      if (entries.length === 0) {
        this._tapMap.delete(listener);
      }
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // 在插件销毁之前调用 onDestroy 监听器
    const destroyFn = this._destroyListenerFn;
    if (destroyFn) {
      destroyFn({ root: this as FilterApi<TDraft> });
    }

    this.plugin.dispose();
    super.dispose();

    this.hooks.destroy.call({});

    // 清理 tapMap
    this._tapMap.clear();
  }
}
