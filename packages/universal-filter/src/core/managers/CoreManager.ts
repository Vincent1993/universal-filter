import type {
  FormPathPattern,
  IFormMergeStrategy,
  IFormState,
  Form,
  IFieldResetOptions,
} from '@formily/core';
import {
  createForm,
  onFormSubmitStart,
  onFormSubmitSuccess,
  onFormValidateFailed,
  onFormValuesChange,
} from '@formily/core';
import { toJS, define, observable } from '@formily/reactive';
import type { Draft, FilterEventMap, FilterListeners, FilterOptions } from '../types';
import { cloneDeep, isEqual, debounce } from 'es-toolkit';

// CoreManager 扩展选项
interface CoreOptions<TDraft extends Draft> extends FilterOptions<TDraft> {
  emitFn?: <K extends keyof FilterEventMap<TDraft>>(
    event: K,
    payload: FilterEventMap<TDraft>[K]
  ) => void;
}

/**
 * CoreManager - 核心状态管理器
 *
 * 参考 Formily Form 设计，提供基于 Formily 的状态管理能力
 * 包括草稿管理、快照、验证等功能
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
  applied?: TDraft;

  /** 上一次的状态快照（apply 开始时的状态，可用于撤销或对比） */
  previous?: TDraft;

  /** 上一次的草稿状态（用于 draft:change 事件中的 prev 参数） */
  private previousDraft?: TDraft;

  /** 事件发射函数 (由 Controller 提供) */
  private emitFn?: <K extends keyof FilterEventMap<TDraft>>(
    event: K,
    payload: FilterEventMap<TDraft>[K]
  ) => void;

  /** 防抖版本的 apply 执行函数 */
  private debouncedApply?: ReturnType<typeof debounce<() => Promise<void>>>;

  /** changed 状态的缓存 */
  private _changedCache?: { draft: TDraft; defaultValues: TDraft | undefined; result: boolean };

  // ==================== 构造函数 ====================

  constructor(optionsConfig: CoreOptions<TDraft> = {}) {
    this.initialize(optionsConfig);
    this.makeForm(optionsConfig);
    this.makeObservable();
    this.setupApplyEffects();
    this.setupDebouncedApply();
  }

  // ==================== 初始化方法 ====================

  /**
   * 初始化基础配置
   * @internal
   */
  protected initialize(config: CoreOptions<TDraft>): void {
    this.listeners = config.listeners;
    this.defaultValues = config.defaultValues;
    this.emitFn = config.emitFn;
    this.applyDebounceMs = config.applyDebounceMs;
  }

  /**
   * 设置防抖版本的 apply 函数
   * @internal
   */
  protected setupDebouncedApply(): void {
    // 如果配置了防抖延迟，创建防抖版本的 apply 函数
    if (this.applyDebounceMs && this.applyDebounceMs > 0) {
      this.debouncedApply = debounce(
        async () => {
          await this.form.submit();
        },
        this.applyDebounceMs
      );
    }
  }

  /**
   * 设置响应式属性（让快照属性可被 Formily 追踪）
   * @internal
   */
  protected makeObservable(): void {
    define(this, {
      applied: observable.ref,
      previous: observable.ref,
    });
  }

  /**
   * 创建 Formily 表单实例
   * @internal
   */
  protected makeForm(config: CoreOptions<TDraft>): void {
    this.form = createForm({
      initialValues: this.defaultValues,
      values: config.values,
      ...config.formilyOptions,
    }) as Form;

    // previousDraft 初始化为 undefined，第一次值变化时会传递 undefined 作为 prev
    // 这样符合监听器的预期：第一次变化时 prev 应该是 undefined
  }

  /**
   * 设置 Apply 流程的事件效果
   * @internal
   */
  protected setupApplyEffects(): void {
    this.form.addEffects('filter-apply', () => {
      // 监听表单值变化
      onFormValuesChange((form) => {
        const nextDraft = toJS(form.values) as TDraft;
        const prevDraft = this.previousDraft;
        // 更新 previousDraft 用于下次变化时使用（深拷贝以保持独立性）
        this.previousDraft = cloneDeep(nextDraft);
        // 清除 changed 缓存，因为 draft 已变化（onFormValuesChange 已触发，说明值已变化）
        this._changedCache = undefined;
        this.listeners?.onDraftChange?.(nextDraft, prevDraft);
        this.emitFn?.('draft:change', {
          draft: nextDraft,
          prev: prevDraft,
        });
      });

      // 监听提交开始
      onFormSubmitStart((form) => {
        // previous 保存 apply 开始时的状态
        this.previous = cloneDeep(this.draft);
        const current = toJS(form.values) as TDraft;
        this.listeners?.onApplyStart?.({ draft: current });
        this.emitFn?.('apply:start', { draft: current });
      });

      // 监听提交成功
      onFormSubmitSuccess((form) => {
        const currentDraft = toJS(form.values) as TDraft;
        const clonedCurrentDraft = cloneDeep(currentDraft);
        // 先设置 applied 为原始 draft（插件可能会在事件中修改它）
        this.applied = clonedCurrentDraft;
        const payload = clonedCurrentDraft;

        // 更新 previousDraft 为 apply 时的状态，用于下次值变化时的 prev 参数
        this.previousDraft = clonedCurrentDraft;

        // 触发事件，允许插件修改 applied
        this.listeners?.onApplySuccess?.({ draft: currentDraft, payload });
        this.emitFn?.('apply:success', { draft: currentDraft, payload });

        // 注意：如果插件在事件中修改了 applied，修改后的值会保留
        // 这允许数据转换插件在 apply:success 时转换 applied 数据
      });

      // 监听验证失败
      onFormValidateFailed((form) => {
        const errors = form.getState().errors;
        const current = toJS(form.getFormState().values) as TDraft;
        this.listeners?.onValidateFailed?.({ draft: current, errors });
        this.emitFn?.('validate:failed', { draft: current, errors });
      });
    });
  }

  // ==================== 计算属性 (Getters) ====================

  /**
   * 获取当前草稿状态
   * 使用 toJS 从 Formily 响应式对象转换为普通对象
   */
  get draft(): TDraft {
    return toJS(this.form.values) as TDraft;
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
  setValues = (
    values: Partial<TDraft>,
    strategy?: IFormMergeStrategy
  ): void => {
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
  setInitialValues = (
    values: Partial<TDraft>,
    strategy?: IFormMergeStrategy
  ): void => {
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

    this.listeners?.onReset?.({ scope: 'all' });
    this.emitFn?.('reset', { scope: 'all' });
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
    this.applied = undefined;
    this.previous = undefined;
    this.previousDraft = undefined;
    this._changedCache = undefined;
    this.emitFn = undefined;
    this.applyDebounceMs = undefined;
  }
}
