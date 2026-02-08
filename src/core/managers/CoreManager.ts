import type {
  FormPathPattern,
  IFormMergeStrategy,
  IFormState,
  Form,
  IFieldResetOptions,
} from '@formily/core';
import {
  createForm,
  onFormInitialValuesChange,
  onFormMount,
  onFormSubmitStart,
  onFormSubmitSuccess,
  onFormValidateFailed,
  onFormValuesChange,
} from '@formily/core';
import { toJS, define, observable } from '@formily/reactive';
import type { Draft, FilterListeners, FilterOptions } from '../types';
import { cloneDeep, isEqual, debounce } from 'es-toolkit';
import { createFilterHooks, type FilterHooks } from '../hooks';

/**
 * CoreManager - 核心状态管理器
 *
 * hooks 是整个系统的唯一事件源（基于 tapable）。
 *
 * @template TDraft - 草稿数据类型
 */
export class CoreManager<TDraft extends Draft> {
  /** Formily 表单实例 */
  form!: Form;

  /** 默认值 */
  defaultValues: TDraft | undefined;

  /** 防抖延迟时间（毫秒） */
  private applyDebounceMs?: number;

  /** 已应用的状态快照（最后一次 apply 成功的状态） */
  _applied?: TDraft;

  /** 上一次应用的状态快照（最后一次 apply 成功的状态） */
  _lastApplied?: TDraft;

  /** 上一次的状态快照（apply 开始时的状态，可用于撤销或对比） */
  _previous?: TDraft;

  /** 上一次的草稿状态（用于 draft:change 事件中的 prev 参数） */
  private previousDraft?: TDraft;

  /** 防抖版本的 apply 执行函数 */
  private debouncedApply?: ReturnType<typeof debounce<() => Promise<void>>>;

  /** changed 状态的缓存 */
  private _changedCache?: { draft: TDraft; defaultValues: TDraft | undefined; result: boolean };

  /** 当前 apply 的 Promise resolve 函数 */
  private applyResolve?: () => void;

  /** 当前 apply 的 Promise reject 函数 */
  private applyReject?: (error: unknown) => void;

  /** 防止 beforeDraftChange 回写时触发无限循环 */
  private _skipBeforeDraftChange = false;

  /** 统一钩子注册表（基于 tapable） */
  readonly hooks: FilterHooks<TDraft>;

  // ==================== 构造函数 ====================

  constructor(optionsConfig: FilterOptions<TDraft> = {}) {
    this.hooks = createFilterHooks<TDraft>();
    this.initialize(optionsConfig);
    this.makeObservable();
    this.makeForm(optionsConfig);
    this.setupApplyEffects();
    this.setupDebouncedApply();
    this.registerListenersAsHookTaps(optionsConfig.listeners);
  }

  // ==================== 初始化方法 ====================

  protected initialize(config: FilterOptions<TDraft>): void {
    this.defaultValues = config.defaultValues;
    this.applyDebounceMs = config.applyDebounceMs;
  }

  protected setupDebouncedApply(): void {
    if (this.applyDebounceMs && this.applyDebounceMs > 0) {
      this.debouncedApply = debounce(async () => {
        await this.form.submit();
      }, this.applyDebounceMs);
    }
  }

  protected makeObservable(): void {
    define(this, {
      _applied: observable.ref,
      _lastApplied: observable.ref,
      _previous: observable.ref,
    });
  }

  protected makeForm(config: FilterOptions<TDraft>): void {
    this.form = createForm({
      initialValues: this.defaultValues,
      values: config.values,
      ...config.formilyOptions,
    }) as Form;
  }

  /**
   * 将 FilterListeners 回调注册为 hook taps
   * @internal
   */
  protected registerListenersAsHookTaps(listeners?: FilterListeners<TDraft>): void {
    if (!listeners) return;

    if (listeners.onDraftChange) {
      const fn = listeners.onDraftChange;
      this.hooks.draftChange.tap('listener:onDraftChange', (payload) => {
        fn(payload.draft, payload.prev);
      });
    }

    if (listeners.onApplyStart) {
      const fn = listeners.onApplyStart;
      this.hooks.applyStart.tap('listener:onApplyStart', (payload) => {
        fn({ draft: payload.draft });
      });
    }

    if (listeners.onApplySuccess) {
      const fn = listeners.onApplySuccess;
      this.hooks.applySuccess.tap('listener:onApplySuccess', (payload) => {
        fn({ draft: payload.draft, payload: payload.payload });
      });
    }

    if (listeners.onValidateFailed) {
      const fn = listeners.onValidateFailed;
      this.hooks.validateFailed.tap('listener:onValidateFailed', (payload) => {
        fn({ draft: payload.draft, errors: payload.errors });
      });
    }

    if (listeners.onReset) {
      const fn = listeners.onReset;
      this.hooks.reset.tap('listener:onReset', (payload) => {
        fn({ scope: payload.scope as 'all' | 'field' | 'group', target: payload.target });
      });
    }

    if (listeners.onInit) {
      const fn = listeners.onInit;
      this.hooks.init.tap('listener:onInit', (payload) => {
        fn({ root: payload.root });
      });
    }

    if (listeners.onDestroy) {
      const fn = listeners.onDestroy;
      this.hooks.destroy.tap('listener:onDestroy', (payload) => {
        fn({ root: payload.root });
      });
    }
  }

  /**
   * 设置 Apply 流程的事件效果
   * @internal
   */
  protected setupApplyEffects(): void {
    this.form.addEffects('filter-apply', () => {
      onFormMount((form) => {
        this.setInitialValues(form.initialValues, 'overwrite');
      });
      onFormInitialValuesChange((form) => {
        this.defaultValues = cloneDeep(form.initialValues) as TDraft;
      });

      // 监听表单值变化
      onFormValuesChange((form) => {
        // 防止 beforeDraftChange 回写引起的无限循环
        if (this._skipBeforeDraftChange) return;

        let nextDraft = toJS(form.values) as TDraft;
        const prevDraft = this.previousDraft;

        // beforeDraftChange 瀑布流：允许拦截并转换草稿数据
        if (this._hasTaps(this.hooks.beforeDraftChange)) {
          const transformed = this.hooks.beforeDraftChange.call(cloneDeep(nextDraft));
          if (!isEqual(transformed, nextDraft)) {
            this._skipBeforeDraftChange = true;
            this.form.setValues(transformed as Partial<TDraft>, 'overwrite');
            this._skipBeforeDraftChange = false;
            nextDraft = transformed;
          }
        }

        this.previousDraft = cloneDeep(nextDraft);
        this._changedCache = undefined;

        this.hooks.draftChange.call({
          draft: cloneDeep(nextDraft),
          prev: cloneDeep(prevDraft),
        });
      });

      // 监听提交开始
      onFormSubmitStart((form) => {
        this._previous = this.draft;
        const current = form.values as TDraft;
        this.hooks.applyStart.call({ draft: current });
      });

      // 监听提交成功
      onFormSubmitSuccess(async (form) => {
        const currentDraft = form.values as TDraft;
        const snapshot = toJS(form.values) as TDraft;

        this.previousDraft = cloneDeep(snapshot);

        let transformedApplied = snapshot;
        try {
          if (this._hasTaps(this.hooks.processSnapshot)) {
            transformedApplied = await this.hooks.processSnapshot.promise(
              snapshot,
              currentDraft
            );
          }
        } catch (error) {
          if (this.applyReject) {
            this.applyReject(error);
            return;
          }
          throw error;
        }

        this._applied = cloneDeep(transformedApplied);
        this._lastApplied = cloneDeep(snapshot);

        const payload = {
          draft: currentDraft,
          applied: transformedApplied,
        };

        this.hooks.applySuccess.call({ draft: currentDraft, payload });

        this.applyResolve?.();
        this.applyResolve = undefined;
        this.applyReject = undefined;
      });

      // 监听验证失败
      onFormValidateFailed((form) => {
        const errors = form.getState().errors;
        const current = toJS(form.getFormState().values) as TDraft;
        this.hooks.validateFailed.call({ draft: current, errors });
      });
    });
  }

  /** 检查 hook 是否有注册的 tap @internal */
  private _hasTaps(hook: any): boolean {
    return hook.taps?.length > 0;
  }

  // ==================== 计算属性 ====================

  get draft(): TDraft {
    return toJS(this.form.values) as TDraft;
  }

  get applied(): TDraft | undefined {
    return this._applied ? toJS(this._applied) as TDraft : undefined;
  }

  get lastApplied(): TDraft | undefined {
    return this._lastApplied ? toJS(this._lastApplied) as TDraft : undefined;
  }

  get previous(): TDraft | undefined {
    return this._previous;
  }

  get state(): IFormState {
    return this.form.getState();
  }

  get changed(): boolean {
    if (this._changedCache !== undefined) {
      return this._changedCache.result;
    }
    const result = !isEqual(this.draft, this.defaultValues);
    this._changedCache = {
      draft: this.draft,
      defaultValues: this.defaultValues,
      result,
    };
    return result;
  }

  get initialValues(): TDraft | undefined {
    return toJS(this.form.initialValues) as TDraft | undefined;
  }

  // ==================== 状态操作方法 ====================

  setValues = (values: Partial<TDraft>, strategy?: IFormMergeStrategy): void => {
    this._changedCache = undefined;
    this.form.setValues(values, strategy);
  };

  setValue = (path: FormPathPattern, value: unknown): void => {
    this._changedCache = undefined;
    this.form.setValuesIn(path, value);
  };

  deleteValue = (path: FormPathPattern): void => {
    this._changedCache = undefined;
    this.form.deleteValuesIn(path);
  };

  setInitialValues = (values: Partial<TDraft>, strategy?: IFormMergeStrategy): void => {
    const plainObject = cloneDeep(values) as unknown as TDraft;
    this.defaultValues = plainObject;
    this._changedCache = undefined;
    this.form.setInitialValues(plainObject, strategy);
  };

  clearErrors = (): void => {
    this.form.clearErrors();
  };

  validate = (pattern?: FormPathPattern): Promise<void> => {
    return this.form.validate(pattern);
  };

  /**
   * 应用当前表单状态（触发验证并创建快照）
   *
   * 执行流程：
   * 1. beforeApply BailHook - 可拦截（返回 true 阻止）
   * 2. form.submit() - Formily 验证 + 提交
   * 3. processSnapshot WaterfallHook - 异步数据转换
   * 4. applySuccess - 通知
   */
  apply = async (): Promise<void> => {
    if (this.debouncedApply) {
      await this.debouncedApply();
      return;
    }

    // beforeApply BailHook: 任意 tap 返回 true 则阻止
    if (this._hasTaps(this.hooks.beforeApply)) {
      const bailed = this.hooks.beforeApply.call({ draft: this.draft });
      if (bailed === true) {
        return; // 被拦截，跳过 apply
      }
    }

    if (this._hasTaps(this.hooks.processSnapshot)) {
      return new Promise<void>((resolve, reject) => {
        this.applyResolve = resolve;
        this.applyReject = reject;
        void this.form.submit().catch(reject);
      });
    }

    await this.form.submit();
  };

  reset = (options?: IFieldResetOptions): void => {
    const shouldForceClear = options?.forceClear ?? false;
    const nextValues = shouldForceClear
      ? {}
      : this.defaultValues
      ? cloneDeep(this.defaultValues)
      : {};

    this.form.setValues(nextValues as Partial<TDraft>, 'overwrite');
    this.form.reset('*', {
      forceClear: shouldForceClear,
      validate: options?.validate ?? false,
    });

    this.previousDraft = cloneDeep(nextValues as TDraft);
    this._changedCache = undefined;

    this.hooks.reset.call({ scope: 'all' });
  };

  /** @internal */
  protected dispose(): void {
    if (this.debouncedApply) {
      this.debouncedApply.cancel();
      this.debouncedApply = undefined;
    }

    this.form.removeEffects('filter-apply');
    this.form.onUnmount();

    this.defaultValues = undefined;
    this._applied = undefined;
    this._previous = undefined;
    this.previousDraft = undefined;
    this._changedCache = undefined;
    this.applyDebounceMs = undefined;
    this.applyResolve = undefined;
    this.applyReject = undefined;
  }
}
