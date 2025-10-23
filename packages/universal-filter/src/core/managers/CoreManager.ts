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
import type { Draft, FilterEventMap, FilterListeners, FilterOptions } from '../types';
import { cloneDeep, isEqual } from 'es-toolkit';

// CoreManager 扩展选项,添加 emitFn
interface CoreOptions<TDraft extends Draft> extends FilterOptions<TDraft> {
  emitFn?: <K extends keyof FilterEventMap<TDraft>>(
    event: K,
    payload: FilterEventMap<TDraft>[K]
  ) => void;
}

// ==================== CoreManager 类 ====================

/**
 * CoreManager - 核心状态管理器
 *
 * 提供基于 Formily Form 的状态管理能力，包括草稿、快照、验证等功能
 *
 * @template TDraft - 草稿数据类型
 */
export class CoreManager<TDraft extends Draft> {
  // ==================== 公共只读属性 ====================

  /**
   * 管理器的唯一标识符
   * @readonly
   */
  readonly id!: string;

  /**
   * Formily 表单实例
   * @readonly
   */
  readonly form!: Form;

  // ==================== 公共属性 ====================

  /**
   * 事件监听器集合
   */
  listeners: FilterListeners<TDraft> | undefined;

  /**
   * 默认值
   */
  defaultValues: TDraft | undefined;

  // ==================== 私有状态 ====================
  /** 已应用的快照 */
  private _appliedSnapshot?: TDraft;
  /** 上一次的快照 (apply 之前的状态) */
  private _previousSnapshot?: TDraft;
  /** 事件发射函数 (由 Controller 提供) */
  private emitFn?: <K extends keyof FilterEventMap<TDraft>>(
    event: K,
    payload: FilterEventMap<TDraft>[K]
  ) => void;

  constructor(optionsConfig: CoreOptions<TDraft> = {}) {
    // 1. 提取基础配置
    this.listeners = optionsConfig.listeners;
    this.defaultValues = optionsConfig.defaultValues;
    this.emitFn = optionsConfig.emitFn;

    // 2. 创建 Formily 表单实例
    this.form = createForm({
      initialValues: this.defaultValues,
      values: optionsConfig.values,
      ...optionsConfig.formilyOptions,
    });

    // 3. 设置 ID
    this.id = this.form.id;
  }

  /**
   * 初始化 Formily 事件效果（由 Controller 调用）
   * @internal
   */
  init(): void {
    this.setupApplyEffects();
  }

  // ==================== 草稿状态 (Draft) ====================

  /**
   * 获取当前草稿状态（Formily Proxy，用于表单字段绑定）
   */
  get draft(): TDraft {
    return this.form.values as TDraft;
  }

  /**
   * 获取草稿的深拷贝快照（普通对象，适用于 React 渲染）
   */
  getDraft(): TDraft {
    return cloneDeep(this.form.values) as TDraft;
  }

  // ==================== 已应用状态 (Applied) ====================

  /**
   * 获取已应用的状态快照（最后一次 apply 成功的状态）
   */
  get applied(): TDraft | undefined {
    return this._appliedSnapshot;
  }

  /**
   * 获取已应用状态的副本（最后一次成功提交的状态）
   */
  getApplied(): TDraft | undefined {
    return this._appliedSnapshot;
  }

  // ==================== 上一次状态 (Previous) ====================

  /**
   * 获取上一次的状态快照（apply 开始时的状态，可用于撤销或对比）
   */
  get previous(): TDraft | undefined {
    return this._previousSnapshot;
  }

  /**
   * 获取上一次状态的副本（apply 开始时的状态）
   */
  getPrevious(): TDraft | undefined {
    return this._previousSnapshot;
  }

  // ==================== 表单状态 (State) ====================

  /**
   * 获取表单状态（包含 valid、errors、submitting 等信息）
   * @see https://core.formilyjs.org/zh-CN/api/models/form#iformstate
   */
  get state(): IFormState {
    return this.form.getState();
  }

  /**
   * 获取表单状态（包含 valid、errors、submitting 等信息）
   * @see https://core.formilyjs.org/zh-CN/api/models/form#iformstate
   */
  getState(): IFormState {
    return this.form.getState();
  }

  // ==================== 变化检测 (Changed) ====================

  /**
   * 检查表单是否发生变化（深度比较 draft 与 defaultValues）
   * 如果要检查表单是否已经被操作过，使用 getState().modified 代替
   */
  get changed(): boolean {
    return !isEqual(this.draft, this.defaultValues);
  }

  /**
   * 检查表单是否发生变化（深度比较 draft 与 initialValues）
   * 如果要检查表单是否已经被操作过，使用 getState().modified 代替
   */
  getChanged(): boolean {
    return !isEqual(this.getDraft(), this.form.initialValues);
  }

  // ==================== 其他状态访问 ====================

  /**
   * 获取初始值
   */
  get initialValues(): TDraft | undefined {
    return this.form.initialValues as TDraft | undefined;
  }

  /**
   * 获取默认值
   */
  getDefaultValues(): TDraft | undefined {
    return this.defaultValues;
  }

  /**
   * 获取 Formily Form 实例（谨慎使用，优先使用封装方法）
   * @see https://core.formilyjs.org/zh-CN/api/models/form
   */
  getForm(): Form<TDraft> {
    return this.form;
  }

  // ==================== 表单操作 ====================

  /**
   * 应用当前表单状态（触发验证并创建快照）
   */
  async apply(): Promise<void> {
    await this.form.submit();
  }

  /**
   * 验证表单（可指定字段路径模式）
   * @see https://core.formilyjs.org/zh-CN/api/entry/form-path#formpathpattern
   */
  validate(pattern?: FormPathPattern): Promise<void> {
    return this.form.validate(pattern);
  }

  /**
   * 重置所有字段到默认值
   */
  reset(): void {
    this.form.reset('*', { forceClear: true, validate: false });
    this.form.setValues(this.defaultValues, 'overwrite');
    this.listeners?.onReset?.({ scope: 'all' });
    this.emitFn?.('reset', { scope: 'all' });
  }

  /**
   * 清除所有表单错误
   */
  clearErrors(): void {
    this.form.clearErrors();
  }

  // ==================== 值操作 ====================

  /**
   * 批量设置表单值（支持 overwrite/merge/deepMerge 策略）
   * @see https://core.formilyjs.org/zh-CN/api/models/form#setvalues
   */
  setValues(values: Partial<TDraft>, strategy?: IFormMergeStrategy): void {
    this.form.setValues(values, strategy);
  }

  /**
   * 设置单个字段的值（支持路径如 'user.name' 或 'items.0.name'）
   * @see https://core.formilyjs.org/zh-CN/api/models/form#setvaluesin
   */
  setValue(path: FormPathPattern, value: unknown) {
    this.form.setValuesIn(path, value);
  }

  /**
   * 删除单个字段的值
   * @see https://core.formilyjs.org/zh-CN/api/models/form#deletevaluesin
   */
  deleteValue(path: FormPathPattern) {
    this.form.deleteValuesIn(path);
  }

  /**
   * 设置初始值
   * @see https://core.formilyjs.org/zh-CN/api/models/form#setinitialvalues
   */
  setInitialValues(
    values: Partial<TDraft>,
    strategy?: IFormMergeStrategy
  ): void {
    this.form.setInitialValues(values, strategy);
  }

  // ==================== 内部方法: Apply 流程管理 ====================

  private setupApplyEffects(): void {
    this.form.addEffects('filter-apply', () => {
      onFormValuesChange((form) => {
        const nextDraft = form.values as TDraft;
        this.listeners?.onDraftChange?.(nextDraft, this._previousSnapshot);
        this.emitFn?.('draft:change', {
          draft: nextDraft,
          prev: this._previousSnapshot,
        });
      });
      onFormSubmitStart(() => {
        this._previousSnapshot = cloneDeep(this.draft);
        const current = this.draft;
        this.listeners?.onApplyStart?.({ draft: current });
        this.emitFn?.('apply:start', { draft: current });
      });
      onFormSubmitSuccess(() => {
        this._appliedSnapshot = cloneDeep(this.draft);
        const current = this.draft;
        const payload = this.form.values;
        this.listeners?.onApplySuccess?.({ draft: current, payload });
        this.emitFn?.('apply:success', { draft: current, payload });
      });
      onFormValidateFailed((form) => {
        const errors = form.getState().errors;
        const current = this.draft;
        this.listeners?.onValidateFailed?.({ draft: current, errors });
        this.emitFn?.('validate:failed', { draft: current, errors });
      });
    });
  }
}
