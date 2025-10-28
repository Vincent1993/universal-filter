import type {
  FormPathPattern,
  IFormMergeStrategy,
  IFormState,
  Form,
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
import { cloneDeep, isEqual } from 'es-toolkit';

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

  /** 已应用的状态快照（最后一次 apply 成功的状态） */
  applied?: TDraft;

  /** 上一次的状态快照（apply 开始时的状态，可用于撤销或对比） */
  previous?: TDraft;

  /** 事件发射函数 (由 Controller 提供) */
  private emitFn?: <K extends keyof FilterEventMap<TDraft>>(
    event: K,
    payload: FilterEventMap<TDraft>[K]
  ) => void;

  // ==================== 构造函数 ====================

  constructor(optionsConfig: CoreOptions<TDraft> = {}) {
    this.initialize(optionsConfig);
    this.makeForm(optionsConfig);
    this.makeObservable();
    this.setupApplyEffects();
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
  }

  /**
   * 设置 Apply 流程的事件效果
   * @internal
   */
  protected setupApplyEffects(): void {
    this.form.addEffects('filter-apply', () => {
      // 监听表单值变化
      onFormValuesChange((form) => {
        const nextDraft = form.values as TDraft;
        this.listeners?.onDraftChange?.(nextDraft, this.previous);
        this.emitFn?.('draft:change', {
          draft: nextDraft,
          prev: this.previous,
        });
      });

      // 监听提交开始
      onFormSubmitStart((form) => {
        this.previous = cloneDeep(this.draft);
        const current = cloneDeep(form.values) as TDraft;
        this.listeners?.onApplyStart?.({ draft: current });
        this.emitFn?.('apply:start', { draft: current });
      });

      // 监听提交成功
      onFormSubmitSuccess((form) => {
        this.applied = toJS(form.values) as TDraft;
        const current = this.draft;
        const payload = cloneDeep(form.values) as TDraft;
        this.listeners?.onApplySuccess?.({ draft: current, payload });
        this.emitFn?.('apply:success', { draft: current, payload });
      });

      // 监听验证失败
      onFormValidateFailed((form) => {
        const errors = form.getState().errors;
        const current = form.getFormState().values;
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
   */
  get changed(): boolean {
    return !isEqual(this.draft, this.defaultValues);
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
    this.form.setValues(values, strategy);
  };

  /**
   * 设置单个字段的值（支持路径如 'user.name' 或 'items.0.name'）
   * @see https://core.formilyjs.org/zh-CN/api/models/form#setvaluesin
   */
  setValue = (path: FormPathPattern, value: unknown): void => {
    this.form.setValuesIn(path, value);
  };

  /**
   * 删除单个字段的值
   * @see https://core.formilyjs.org/zh-CN/api/models/form#deletevaluesin
   */
  deleteValue = (path: FormPathPattern): void => {
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
   */
  apply = async (): Promise<void> => {
    await this.form.submit();
  };

  /**
   * 重置所有字段到默认值
   */
  reset = (): void => {
    this.form.reset('*', { forceClear: false, validate: false });
    this.listeners?.onReset?.({ scope: 'all' });
    this.emitFn?.('reset', { scope: 'all' });
  };
}
