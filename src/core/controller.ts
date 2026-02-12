import type {
  Draft,
  FilterApi,
  FilterEventMap,
  FilterOptions,
  PluginFactory,
} from './types';
import { CoreManager, PluginManager } from './managers';
import { getGlobalConfigure } from '../context';
import { define, observable, action } from '@formily/reactive';
import { onFormMount } from '@formily/core';

/**
 * 事件名 → hook 名的运行时映射表
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
 *
 * 继承 CoreManager，组合 PluginManager。
 * 通过 tapable hooks 作为唯一事件源协调模块间通信。
 */
export class FilterController<TDraft extends Draft>
  extends CoreManager<TDraft>
  implements FilterApi<TDraft>
{
  private disposed = false;

  readonly plugin: PluginManager<TDraft>;

  ready = false;

  private _isFormMounted = false;
  private _arePluginsReady = false;
  private _optionsConfig: FilterOptions<TDraft>;

  // on/off/once 支持
  private _tapCounter = 0;
  private _tapMap = new Map<Function, { tapName: string; hookName: string }[]>();

  constructor(optionsConfig: FilterOptions<TDraft> = {}) {
    const configure = getGlobalConfigure<TDraft>();
    const globalPlugins = (configure.defaults?.plugins ?? []) as PluginFactory<TDraft>[];
    const instancePlugins = (optionsConfig.plugins ?? []) as PluginFactory<TDraft>[];
    const strategy = configure.mergeStrategy?.plugins ?? 'append';

    // === resolveOptions 预初始化阶段 ===
    // 在 Formily Form 创建之前，允许直接传入的插件对象修改 FilterOptions
    // 典型用途：urlSyncPlugin 在此阶段将 URL 参数注入 defaultValues
    const mergedFactories = strategy === 'prepend'
      ? [...instancePlugins, ...globalPlugins]
      : [...globalPlugins, ...instancePlugins];

    let resolvedConfig = optionsConfig;
    for (const factory of mergedFactories) {
      if (typeof factory !== 'function' && typeof factory.resolveOptions === 'function') {
        resolvedConfig = factory.resolveOptions(resolvedConfig);
      }
    }

    // CoreManager 使用解析后的配置创建 Formily Form
    super(resolvedConfig);

    this._optionsConfig = resolvedConfig;
    this.makeControllerObservable();
    this.setupReadyCheck(optionsConfig);

    this.plugin = new PluginManager(
      this.hooks,
      instancePlugins,
      globalPlugins,
      strategy,
      this as FilterApi<TDraft>
    );

    this.hooks.init.call({ root: this as FilterApi<TDraft> });

    if (optionsConfig.autoApply?.onChange) {
      this.hooks.draftChange.tap('autoApply:onChange', () => {
        queueMicrotask(() => void this.apply());
      });
    }
  }

  protected makeControllerObservable() {
    define(this, {
      ready: observable.ref,
      setReady: action,
    });
  }

  setReady(ready: boolean) {
    this.ready = ready;
  }

  private setupReadyCheck(_optionsConfig: FilterOptions<TDraft>) {
    this.hooks.pluginsReady.tap('controller:readyCheck:plugins', ({ ready }) => {
      this._arePluginsReady = ready;
      this.checkReadyState();
    });

    this.form.addEffects('controller-ready-check', () => {
      onFormMount(() => {
        this._isFormMounted = true;
        this.checkReadyState();
      });
    });
  }

  private checkReadyState(optionsConfig?: FilterOptions<TDraft>) {
    const config = optionsConfig || this._optionsConfig;

    if (this._isFormMounted && this._arePluginsReady && !this.ready) {
      this.setReady(true);
      this.hooks.ready.call({ root: this as FilterApi<TDraft> });

      if (config?.autoApply?.onInit) {
        void this.apply();
      }
    }
  }

  // ============== waitForReady ==============

  waitForReady(timeout?: number): Promise<void> {
    if (this.ready) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const timer = timeout != null
        ? setTimeout(() => {
            reject(new Error(`waitForReady timed out after ${timeout}ms`));
          }, timeout)
        : undefined;

      const tapName = `__waitForReady_${this._tapCounter++}`;
      let resolved = false;

      this.hooks.ready.tap(tapName, () => {
        if (resolved) return;
        resolved = true;
        if (timer) clearTimeout(timer);
        this._removeTap(this.hooks.ready, tapName);
        resolve();
      });
    });
  }

  // ============== 公开事件 API ==============

  on<K extends keyof FilterEventMap<TDraft>>(
    event: K,
    listener: (payload: FilterEventMap<TDraft>[K]) => void
  ): () => void {
    const hookName = EVENT_TO_HOOK[event as string];
    if (!hookName) return () => {};

    const hook = (this.hooks as any)[hookName];
    if (!hook) return () => {};

    const tapName = `__on_${this._tapCounter++}`;
    hook.tap(tapName, listener);

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
    if (!hookName) return () => {};

    const hook = (this.hooks as any)[hookName];
    if (!hook) return () => {};

    const tapName = `__once_${this._tapCounter++}`;
    let fired = false;

    const wrappedListener = (payload: any) => {
      if (fired) return;
      fired = true;
      this._removeTap(hook, tapName);
      listener(payload);
    };

    hook.tap(tapName, wrappedListener);

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
   * 从 tapable hook 内部移除指定 tap（带健壮性回退）
   * @internal
   */
  private _removeTap(hook: any, tapName: string): void {
    if (!hook.taps) return;
    const originalLength = hook.taps.length;
    hook.taps = hook.taps.filter((t: any) => t.name !== tapName);
    if (hook.taps.length !== originalLength) {
      // 重置编译缓存
      if (typeof hook._resetCompilation === 'function') {
        hook._resetCompilation();
      } else {
        // 回退：重置编译后的委托函数
        if (hook._call) hook.call = hook._call;
        if (hook._callAsync) hook.callAsync = hook._callAsync;
        if (hook._promise) hook.promise = hook._promise;
      }
    }
  }

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

    this.plugin.dispose();
    super.dispose();

    // destroy hook 现在包含 root，onDestroy listener 通过 hook tap 自动调用
    this.hooks.destroy.call({ root: this as FilterApi<TDraft> });

    this._tapMap.clear();
  }
}
