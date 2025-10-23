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

// ==================== 类型定义 ====================

/**
 * CoreManager 的公共接口定义
 *
 * 定义了状态管理器的所有公共 API 和行为契约
 *
 * @template TDraft - 草稿数据类型
 */
export interface ICoreManager<TDraft extends Draft> {
  // ==================== 只读属性 ====================

  /**
   * 管理器的唯一标识符
   * @readonly
   */
  readonly id: string;

  /**
   * Formily 表单实例
   * @readonly
   */
  readonly form: Form;

  // ==================== 公共属性 ====================

  /**
   * 事件监听器集合
   */
  listeners: FilterListeners<TDraft> | undefined;

  /**
   * 默认值
   */
  defaultValues: TDraft | undefined;

  // ==================== 状态访问 ====================

  /**
   * 获取当前草稿状态（可变）
   * @returns 当前表单的可变状态
   * @remarks
   * - 这是用户正在编辑的工作副本
   * - 直接映射到 Formily 的 form.values
   * - 是可变的，会随着用户输入实时更新
   */
  readonly draft: TDraft;

  /**
   * 获取已应用的状态快照（不可变）
   * @returns 最后一次 apply 成功的状态快照，如果从未 apply 过则为 undefined
   * @remarks
   * - 代表最后一次成功提交的状态
   * - 是深拷贝的独立副本，不会随 draft 变化
   * - 通常用于对比或回滚
   */
  readonly applied: TDraft | undefined;

  /**
   * 获取上一次的状态快照（不可变）
   * @returns apply 开始时的状态快照，如果从未 apply 过则为 undefined
   * @remarks
   * - 保存 apply 开始时（onFormSubmitStart）的状态
   * - 可用于实现撤销功能或对比变更
   * - 是深拷贝的独立副本
   */
  readonly previous: TDraft | undefined;

  /**
   * 获取 Formily 表单状态
   * @returns Formily Form 完整状态对象
   * @see https://core.formilyjs.org/zh-CN/api/models/form#iformstate
   * @remarks
   * 包含表单的所有元信息：
   * - valid: 是否通过验证
   * - invalid: 是否未通过验证
   * - errors: 错误信息数组
   * - warnings: 警告信息数组
   * - modified: 是否被修改过
   * - submitting: 是否正在提交
   * - validating: 是否正在验证
   * - 等等...
   */
  readonly state: IFormState;

  /**
   * 检查表单是否发生变化
   * @returns true 表示当前 draft 与 previous 不同
   * @remarks
   * - 使用深度相等比较（isEqual）
   * - 如果 previous 不存在，返回 false
   */
  readonly changed: boolean;

  // ==================== 表单操作 ====================

  /**
   * 应用当前表单状态
   * @returns Promise，成功时 resolve，失败时 reject
   * @remarks
   * 触发 Formily 的提交流程：
   * 1. onFormSubmitStart - 创建 previous 快照
   * 2. 执行表单验证
   * 3. onFormSubmitSuccess - 创建 applied 快照
   * 4. 或 onFormValidateFailed - 验证失败
   */
  apply(): Promise<void>;

  /**
   * 验证表单
   * @param pattern - 可选的字段路径模式，用于验证特定字段
   * @returns Promise，验证成功时 resolve，失败时 reject 并包含错误信息
   * @see https://core.formilyjs.org/zh-CN/api/entry/form-path#formpathpattern
   * @example
   * ```ts
   * // 验证所有字段
   * await manager.validate();
   *
   * // 验证特定字段
   * await manager.validate('user.name');
   *
   * // 验证多个字段（使用通配符）
   * await manager.validate('user.*');
   * ```
   */
  validate(pattern?: FormPathPattern): Promise<void>;

  /**
   * 重置所有字段到默认值
   * @remarks
   * - 清空所有字段值
   * - 重置为 defaultValues
   * - 清除验证状态和错误
   * - 触发 onReset 监听器
   */
  reset(): void;

  /**
   * 清除所有表单错误
   * @remarks
   * 只清除错误状态，不影响字段值
   */
  clearErrors(): void;

  /**
   * 批量设置表单值
   * @param values - 要设置的值对象（部分更新）
   * @param strategy - 合并策略
   * @see https://core.formilyjs.org/zh-CN/api/models/form#setvalues
   * @remarks
   * 合并策略说明：
   * - 'overwrite': 覆盖整个对象（默认）
   * - 'merge': 浅合并
   * - 'deepMerge': 深度合并
   * - 'shallowMerge': 浅合并（同 merge）
   *
   * @example
   * ```ts
   * // 覆盖模式（默认）
   * manager.setValues({ name: 'John' });
   *
   * // 深度合并模式
   * manager.setValues({ user: { age: 30 } }, 'deepMerge');
   * ```
   */
  setValues(values: Partial<TDraft>, strategy?: IFormMergeStrategy): void;

  /**
   * 设置单个字段的值
   * @param path - 字段路径
   * @param value - 要设置的值
   * @see https://core.formilyjs.org/zh-CN/api/models/form#setvaluesin
   * @see https://core.formilyjs.org/zh-CN/api/entry/form-path#formpathpattern
   * @example
   * ```ts
   * // 设置简单字段
   * manager.setValue('name', 'John');
   *
   * // 设置嵌套字段
   * manager.setValue('user.name', 'John');
   *
   * // 设置数组项
   * manager.setValue('items.0.name', 'Item 1');
   * manager.setValue('items[1].name', 'Item 2');
   * ```
   */
  setValue(path: FormPathPattern, value: unknown): void;

  /**
   * 删除单个字段的值
   * @param path - 字段路径
   * @see https://core.formilyjs.org/zh-CN/api/models/form#deletevaluesin
   * @see https://core.formilyjs.org/zh-CN/api/entry/form-path#formpathpattern
   * @example
   * ```ts
   * // 删除简单字段
   * manager.deleteValue('name');
   *
   * // 删除嵌套字段
   * manager.deleteValue('user.email');
   *
   * // 删除数组项
   * manager.deleteValue('items.0');
   * ```
   */
  deleteValue(path: FormPathPattern): void;

  /**
   * 设置初始值
   * @param values - 要设置的值对象（部分更新）
   * @param strategy - 合并策略
   * @see https://core.formilyjs.org/zh-CN/api/models/form#setinitialvalues
   */
  setInitialValues(values: Partial<TDraft>, strategy?: IFormMergeStrategy): void;
}

// ==================== 实现类 ====================

export class CoreManager<TDraft extends Draft> implements ICoreManager<TDraft> {
  // ==================== 公共只读属性 ====================
  readonly id!: string;
  readonly form!: Form;

  // ==================== 公共属性 ====================
  listeners: FilterListeners<TDraft> | undefined;
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

    // 4. 延迟设置事件,等待 Controller 初始化完成
    // setupApplyEffects 会在 Controller 构造器中调用
  }

  /**
   * 初始化 Formily 事件效果（由 Controller 调用）
   * @internal
   */
  initializeEffects(): void {
    this.setupApplyEffects();
  }

  // ==================== 公共 API: 状态访问 ====================

  get draft(): TDraft {
    return this.form.values as TDraft;
  }

  get applied(): TDraft | undefined {
    return this._appliedSnapshot;
  }

  get previous(): TDraft | undefined {
    return this._previousSnapshot;
  }

  get initialValues(): TDraft | undefined {
    return this.form.initialValues as TDraft | undefined;
  }

  get state(): IFormState {
    return this.form.getState();
  }

  get changed(): boolean {
    return isEqual(this.draft, this._previousSnapshot);
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

  // ==================== 公共 API: 表单操作 ====================

  async apply(): Promise<void> {
    await this.form.submit();
  }

  validate(pattern?: FormPathPattern): Promise<void> {
    return this.form.validate(pattern);
  }

  reset(): void {
    this.form.reset('*', { forceClear: true, validate: false });
    this.form.setValues(this.defaultValues, 'overwrite');
    this.listeners?.onReset?.({ scope: 'all' });
    this.emitFn?.('reset', { scope: 'all' });
  }

  clearErrors(): void {
    this.form.clearErrors();
  }

  setValues(values: Partial<TDraft>, strategy?: IFormMergeStrategy): void {
    this.form.setValues(values, strategy);
  }

  setValue(path: FormPathPattern, value: unknown) {
    this.form.setValuesIn(path, value);
  }

  setInitialValues(
    values: Partial<TDraft>,
    strategy?: IFormMergeStrategy
  ): void {
    this.form.setInitialValues(values, strategy);
  }

  deleteValue(path: FormPathPattern) {
    this.form.deleteValuesIn(path);
  }
}
