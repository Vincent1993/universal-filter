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
 * 参考 Formily Form 设计，提供基于 Formily 的状态管理能力
 * 包括草稿管理、快照、验证等功能
 *
 * hooks 是整个系统的唯一事件源（基于 tapable），
 * 移除了原有的 emitFn 透传模式。
 *
 * @template TDraft - 草稿数据类型
 */
export class CoreManager<TDraft extends Draft> {
  /** Formily 表单实例 */
  form!: Form;

  /** 事件监听器集合 */
  listeners: FilterListeners<TDraft> | undefined;

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

  /** 当前 apply 的 Promise resolve 函数（用于等待异步 hooks 完成） */
  private applyResolve?: () => void;

  /** 当前 apply 的 Promise reject 函数 */
  private applyReject?: (error: unknown) => void;

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

  /**
   * 初始化基础配置
   * @internal
   */
  protected initialize(config: FilterOptions<TDraft>): void {
    this.listeners = config.listeners;
    this.defaultValues = config.defaultValues;
    this.applyDebounceMs = config.applyDebounceMs;
  }

  /**
   * 设置防抖版本的 apply 函数
   * @internal
   */
  protected setupDebouncedApply(): void {
    // 如果配置了防抖延迟，创建防抖版本的 apply 函数
    if (this.applyDebounceMs && this.applyDebounceMs > 0) {
      this.debouncedApply = debounce(async () => {
        await this.form.submit();
      }, this.applyDebounceMs);
    }
  }

  /**
   * 设置响应式属性（让快照属性可被 Formily 追踪）
   * @internal
   */
  protected makeObservable(): void {
    define(this, {
      _applied: observable.ref,
      _lastApplied: observable.ref,
      _previous: observable.ref,
    });
  }

  /**
   * 创建 Formily 表单实例
   * @internal
   */
  protected makeForm(config: FilterOptions<TDraft>): void {
    this.form = createForm({
      initialValues: this.defaultValues,
      values: config.values,
      ...config.formilyOptions,
    }) as Form;

    // previousDraft 初始化为 undefined，第一次值变化时会传递 undefined 作为 prev
    // 这样符合监听器的预期：第一次变化时 prev 应该是 undefined
  }

  /**
   * 将 FilterListeners 回调注册为 hook taps
   * 统一到 tapable 体系中，不再直接调用 listeners
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
      this.hooks.destroy.tap('listener:onDestroy', () => {
        // 注意：destroy hook 的 payload 是 {}，但 onDestroy 需要 root
        // 这里从闭包中获取不到 root，需要在 controller 层处理
        // 暂时传递一个空占位，controller 会覆盖
      });
      // listener:onDestroy 在 controller 层特殊处理
      this._destroyListenerFn = fn;
    }
  }

  /** @internal - 暂存 onDestroy 回调，由 controller 统一调用 */
  protected _destroyListenerFn?: FilterListeners<TDraft>['onDestroy'];

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
        const nextDraft = toJS(form.values) as TDraft;
        const prevDraft = this.previousDraft;
        // 更新 previousDraft 用于下次变化时使用（深拷贝以保持独立性）
        this.previousDraft = cloneDeep(nextDraft);
        // 清除 changed 缓存，因为 draft 已变化（onFormValuesChange 已触发，说明值已变化）
        this._changedCache = undefined;
        // 通过 hooks 触发事件（统一事件源）
        this.hooks.draftChange.call({
          draft: cloneDeep(nextDraft),
          prev: cloneDeep(prevDraft),
        });
      });

      // 监听提交开始
      onFormSubmitStart((form) => {
        // previous 保存 apply 开始时的状态
        this._previous = this.draft;
        const current = form.values as TDraft;
        this.hooks.applyStart.call({ draft: current });
      });

      // 监听提交成功
      onFormSubmitSuccess(async (form) => {
        const currentDraft = form.values as TDraft;

        // ✅ 使用 toJS 创建一个全新的对象引用
        // 这样 observable.ref 才能检测到引用变化，从而触发更新
        const snapshot = toJS(form.values) as TDraft;

        // 更新 previousDraft
        // 必须深拷贝，否则它会指向 form.values 的引用（或者包含响应式对象），随后的修改会影响它
        this.previousDraft = cloneDeep(snapshot);

        // 执行快照处理钩子（如 codec 转换）
        // 瀑布流执行，允许插件对 snapshot 进行链式处理
        let transformedApplied = snapshot;
        try {
          if (this._hasProcessSnapshotTaps()) {
            transformedApplied = await this.hooks.processSnapshot.promise(
              snapshot,
              currentDraft
            );
          }
        } catch (error) {
          // 处理失败，如果有等待的 Promise，reject 它
          if (this.applyReject) {
            this.applyReject(error);
            return;
          }
          // 否则抛出错误（会被 formily 捕获但可能无法中断外部 await）
          throw error;
        }

        // 设置转换后的 applied
        this._applied = cloneDeep(transformedApplied);
        // 需要设置未转换前的值
        this._lastApplied = cloneDeep(snapshot);

        // 构建 payload，包含转换后的 applied
        const payload = {
          draft: currentDraft,
          applied: transformedApplied,
        };

        // 通过 hooks 触发事件
        this.hooks.applySuccess.call({ draft: currentDraft, payload });

        // 如果有等待的 Promise，resolve 它
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

  /**
   * 检查 processSnapshot 钩子是否有注册的 tap
   * @internal
   */
  private _hasProcessSnapshotTaps(): boolean {
    return (this.hooks.processSnapshot as any).taps?.length > 0;
  }

  // ==================== 计算属性 (Getters) ====================

  /**
   * 获取当前草稿状态
   * 使用 toJS 从 Formily 响应式对象转换为普通对象
   */
  get draft(): TDraft {
    return toJS(this.form.values) as TDraft;
  }

  get applied(): TDraft | undefined {
    return this._applied ? toJS(this._applied) as TDraft : undefined;
  }
  /**
   * 获取最后一次应用的状态快照
   */
  get lastApplied(): TDraft | undefined {
    return this._lastApplied ? toJS(this._lastApplied) as TDraft : undefined;
  }

  get previous(): TDraft | undefined {
    return this._previous;
  }

  /**
   * 获取表单状态（包含 valid、errors、submitting 等信息）
   * @see https://core.formilyjs.org/zh-CN/api/models/form#iformstate
   */
  get state(): IFormState {
    return this.form.getState();
  }

  /**
   * 检查表单是否发生变化（深度比较 draft 与 defaultValues）
   * 如果要检查表单是否已经被操作过，使用 state.modified 代替
   * 使用缓存优化性能：缓存结果，只在 draft 或 defaultValues 明确变化时清除
   */
  get changed(): boolean {
    // 如果缓存存在，直接返回（因为我们会在值变化时清除缓存）
    if (this._changedCache !== undefined) {
      return this._changedCache.result;
    }

    // 执行深度比较并缓存结果
    const result = !isEqual(this.draft, this.defaultValues);
    this._changedCache = {
      draft: this.draft, // 仅用于类型，不用于比较
      defaultValues: this.defaultValues,
      result,
    };

    return result;
  }

  /**
   * 获取初始值
   */
  get initialValues(): TDraft | undefined {
    return toJS(this.form.initialValues) as TDraft | undefined;
  }

  // ==================== 状态操作方法 ====================

  /**
   * 批量设置表单值（支持 overwrite/merge/deepMerge 策略）
   * @see https://core.formilyjs.org/zh-CN/api/models/form#setvalues
   */
  setValues = (values: Partial<TDraft>, strategy?: IFormMergeStrategy): void => {
    // 清除 changed 缓存，因为 draft 将变化
    this._changedCache = undefined;
    this.form.setValues(values, strategy);
  };

  /**
   * 设置单个字段的值（支持路径如 'user.name' 或 'items.0.name'）
   * @see https://core.formilyjs.org/zh-CN/api/models/form#setvaluesin
   */
  setValue = (path: FormPathPattern, value: unknown): void => {
    // 清除 changed 缓存，因为 draft 将变化
    this._changedCache = undefined;
    this.form.setValuesIn(path, value);
  };

  /**
   * 删除单个字段的值
   * @see https://core.formilyjs.org/zh-CN/api/models/form#deletevaluesin
   */
  deleteValue = (path: FormPathPattern): void => {
    // 清除 changed 缓存，因为 draft 将变化
    this._changedCache = undefined;
    this.form.deleteValuesIn(path);
  };

  /**
   * 设置初始值（会切断引用并同步 defaultValues）
   * @see https://core.formilyjs.org/zh-CN/api/models/form#setinitialvalues
   */
  setInitialValues = (values: Partial<TDraft>, strategy?: IFormMergeStrategy): void => {
    const plainObject = cloneDeep(values) as unknown as TDraft;
    this.defaultValues = plainObject;
    this._changedCache = undefined;
    this.form.setInitialValues(plainObject, strategy);
  };

  /**
   * 清除所有表单错误
   */
  clearErrors = (): void => {
    this.form.clearErrors();
  };

  /**
   * 验证表单（可指定字段路径模式）
   * @see https://core.formilyjs.org/zh-CN/api/entry/form-path#formpathpattern
   */
  validate = (pattern?: FormPathPattern): Promise<void> => {
    return this.form.validate(pattern);
  };

  /**
   * 应用当前表单状态（触发验证并创建快照）
   * 如果配置了 applyDebounceMs，会自动防抖
   */
  apply = async (): Promise<void> => {
    if (this.debouncedApply) {
      await this.debouncedApply();
      return;
    }

    // 如果有 hook 监听器，使用 Promise 等待异步完成
    // 注意：Formily 的 submit 不会等待异步 effect 完成，所以需要手动等待
    if (this._hasProcessSnapshotTaps()) {
      return new Promise<void>((resolve, reject) => {
        this.applyResolve = resolve;
        this.applyReject = reject;
        // submit 失败时直接 reject
        void this.form.submit().catch(reject);
      });
    }

    await this.form.submit();
  };


  /**
   * @name 重置所有表单项
   * @param options - 重置选项
   * @param options.forceClear - true 时，会清除所有字段值，false 时，重置到初始化值
   * @param options.validate - 是否触发校验
   * @see https://core.formilyjs.org/zh-CN/api/models/field/#ifieldresetoptions
   * @description 如果需要对单个或者多个字段进行重置操作，用 this.form.reset 方法进行自定义
   */
  reset = (options?: IFieldResetOptions): void => {
    const shouldForceClear = options?.forceClear ?? false;
    const nextValues = shouldForceClear
      ? {}
      : this.defaultValues
      ? cloneDeep(this.defaultValues)
      : {};

    // 先设置值，再重置（这样更高效，避免两次更新）
    this.form.setValues(nextValues as Partial<TDraft>, 'overwrite');
    this.form.reset('*', {
      forceClear: shouldForceClear,
      validate: options?.validate ?? false,
    });

    // 更新 previousDraft
    this.previousDraft = cloneDeep(nextValues as TDraft);
    // 清除 changed 缓存，因为 draft 已重置
    this._changedCache = undefined;

    this.hooks.reset.call({ scope: 'all' });
  };

  /**
   * @internal
   * 清理 CoreManager 内部引用，确保 Formily 实例正确卸载
   */
  protected dispose(): void {
    // 取消防抖函数（如果存在）
    if (this.debouncedApply) {
      this.debouncedApply.cancel();
      this.debouncedApply = undefined;
    }

    this.form.removeEffects('filter-apply');
    this.form.onUnmount();

    this.listeners = undefined;
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
