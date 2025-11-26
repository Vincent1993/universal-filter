import type { Form, GeneralField, IFormProps } from '@formily/core';
import type { ISchema } from '@formily/json-schema';
import type { ReactNode } from 'react';
import type { CoreManager } from './managers';
import type EventEmitter from 'eventemitter3';
import type { PluginManager } from './managers/PluginManager';
import type { OptionsRuntimeConfig } from './option-source';

export type Draft = Record<string, any>;
export type JsonRecord = Record<string, unknown>;

// 事件总线类型
export interface PluginDisposeError {
  name: string;
  error: unknown;
}

export interface FilterEventMap<TDraft extends Draft = Draft> {
  'draft:change': { draft: TDraft; prev?: TDraft };
  'apply:start': { draft: TDraft };
  'apply:success': { draft: TDraft; payload: unknown };
  'validate:failed': { draft: TDraft; errors: Form['errors'] };
  'reset': { scope: 'all' | 'group' | string; target?: string };
  'plugin:ready': { name: string; ready: boolean; error?: unknown };
  'plugins:ready': { ready: boolean };
  'plugins:attached': { total: number };
  'plugins:destroyed': { errors: PluginDisposeError[] };
  'destroy': {};
}

export interface FilterEvents<TDraft extends Draft = Draft> {
  on<K extends keyof FilterEventMap<TDraft>>(
    event: K,
    listener: (payload: FilterEventMap<TDraft>[K]) => void
  ): () => void;
  once<K extends keyof FilterEventMap<TDraft>>(
    event: K,
    listener: (payload: FilterEventMap<TDraft>[K]) => void
  ): () => void;
  off<K extends keyof FilterEventMap<TDraft>>(
    event: K,
    listener: (payload: FilterEventMap<TDraft>[K]) => void
  ): void;
}

// 内部总线（模块用）可有 emit，但不对外暴露
export interface InternalFilterBus<TDraft extends Draft = Draft> extends FilterEvents<TDraft> {
  emit<K extends keyof FilterEventMap<TDraft>>(event: K, payload: FilterEventMap<TDraft>[K]): void;
}

// 模块契约（后续模块化装配使用）
export interface ModuleContext<TDraft extends Draft = Draft> {
  root: FilterApi<TDraft>;
  bus: InternalFilterBus<TDraft>;
  setReady(ready: boolean, err?: unknown): void;
  isReady(): boolean;
}

export interface Module<TDraft extends Draft = Draft, TOptions = unknown> {
  readonly name: string;
  readonly namespace: string;
  readonly requires?: string[];
  init(ctx: ModuleContext<TDraft>, options?: TOptions): void | Promise<void>;
  getPublicApi(): unknown;
  dispose?(): void | Promise<void>;
}

export interface PluginInitContext<TDraft extends Draft = Draft> {
  /**
   * Filter 实例，可以通过它访问所有 FilterApi 功能，包括事件总线（filter.on/off/once）
   */
  filter: FilterApi<TDraft>;
  /**
   * 插件管理器实例，可以通过它访问和设置插件状态、检查就绪状态等
   */
  pluginManager: PluginManager<TDraft>;
}

export interface Plugin<TDraft extends Draft = Draft> {
  name: string;
  /**
   * 插件初始化，仅与插件自身相关。数据读写应通过 ctx.root 完成。
   */
  onInit?(ctx: PluginInitContext<TDraft>): void | Promise<void>;
  /**
   * 插件销毁
   */
  onDestroy?(): void;
}

/**
 * 插件工厂函数辅助工具
 */
export interface PluginFactoryHelpers<TDraft extends Draft = Draft> {
  root: FilterApi<TDraft>;
  push: (plugin: Plugin<TDraft>) => void;  // 添加插件到末尾
  shift: (plugin: Plugin<TDraft>) => void;  // 添加插件到开头
  remove: (pluginName: string) => void;  // 移除指定插件
}

/**
 * 插件工厂类型：可以是插件对象或工厂函数
 */
export type PluginFactory<TDraft extends Draft = Draft> =
  | Plugin<TDraft>
  | ((helpers: PluginFactoryHelpers<TDraft>) => Plugin<TDraft> | void)

export interface FilterListeners<TDraft extends Draft = Draft> {
  onInit?(ctx: { root: FilterApi<TDraft> }): void;
  onDraftChange?(draft: TDraft, prev?: TDraft): void;
  onFieldChange?(path: string, value: unknown, prev: unknown): void;
  onApplyStart?(ctx: { draft: TDraft }): void;
  onApplySuccess?(ctx: { draft: TDraft; payload: unknown }): void;
  onApplyError?(err: unknown): void;
  onValidateFailed?(ctx: { draft: TDraft; errors: Form['errors'] }): void;
  onReset?(ctx: { scope: 'all' | 'field' | 'group'; target?: string }): void;
  onDestroy?(ctx: { root: FilterApi<TDraft> }): void;
}

export interface FilterOptions<TDraft extends Draft = Draft> {
  values?: TDraft;
  defaultValues?: TDraft;
  external?: JsonRecord;
  listeners?: FilterListeners<TDraft>;
  plugins?: PluginFactory<TDraft>[];
  strict?: boolean;
  applyDebounceMs?: number;
  /**
   * @name Auto Apply
   * @description 自动应用草稿数据到表单，默认情况下，当草稿数据发生变化时，会自动应用到表单
   * @description 当 onInit 为 true 时，会在初始化时自动应用草稿数据到表单
   * @description 当 onChange 为 true 时，会在草稿数据发生变化时自动应用到表单
   */
  autoApply?: {
    onInit?: boolean;
    onChange?: boolean;
  },
  /**
   * @name Formily Form 配置
   * @description 配置 Formily Form 不包括 values 和 initialValues 和 effects
   * @link https://core.formilyjs.org/zh-CN/api/entry/create-form#iformprops
   */
  formilyOptions?: Omit<
    IFormProps<Partial<TDraft>>,
    'values' | 'initialValues' | 'effects'
  >;
}

// EnhancedFieldApi - useField hook 的增强返回类型
export type EnhancedFieldApi = GeneralField & {
  /** 字段的 JSON Schema 配置 */
  readonly schema: ISchema | null;
  /** 表达式作用域 */
  readonly scope: Record<string, any>;
  /** 是否是当前上下文字段（未传 path 时为 true） */
  readonly isContextField: boolean;
}

export interface HeadlessRootOptions<TDraft extends Draft = Draft, TRoot = TDraft> {
  id?: string;
  selector?: (draft: TDraft) => TRoot;
  apply?: (root: FilterApi<TDraft>, next: TRoot) => void;
  immediate?: boolean;
}

export interface HeadlessRoot<TRoot = Draft> {
  id: string;
  getSnapshot(): TRoot;
  setSnapshot(next: TRoot): void;
  subscribe(listener: (value: TRoot) => void): () => void;
  dispose(): void;
}

export interface LoadOptions{
  mode?: 'replace' | 'merge';
  decode?: boolean;
}

// FilterApi - 基于 Formily Form 的过滤器 API
// 通过 form 属性访问所有 Formily 原生功能，同时提供过滤器特定功能
export interface FilterApi<TDraft extends Draft = Draft>
  extends CoreManager<TDraft>,
    FilterEvents<TDraft> {
  /** 插件命名空间 - 直接暴露 PluginManager 实例 */
  readonly plugin: PluginManager<TDraft>;

  /**
   * 销毁当前过滤器实例，触发所有插件和监听器的清理逻辑
   */
  dispose(): void;

  // 预留：其他命名空间（schema/shard/options/group），逐步补齐
  // readonly schema?: SchemaManager<TDraft>;
  // readonly shard?: ShardManager<TDraft>;
  // readonly options?: OptionsManager<TDraft>;
  // readonly group?: GroupManager<TDraft>;
}

export interface GlobalDefaults<TDraft extends Draft = Draft> {
  plugins?: PluginFactory<TDraft>[];
  listeners?: FilterListeners<TDraft>;
  applyDebounceMs?: number;
}


export interface FilterConfigureValue<TDraft extends Draft = Draft> {
  defaults?: GlobalDefaults<TDraft>;
  mergeStrategy?: {
    plugins?: 'prepend' | 'append';
    listeners?: 'shallow' | 'deep';
  };
  options?: OptionsRuntimeConfig;
}

export interface FilterConfigureProps<TDraft extends Draft = Draft> {
  value: FilterConfigureValue<TDraft>;
  children?: ReactNode;
}

export interface FilterProviderProps<TDraft extends Draft = Draft> {
  instance: FilterApi<TDraft>;
  namespace?: string;
  children?: ReactNode;
  /**
   * 自定义错误回退组件
   * @param error - 捕获的错误对象
   * @param errorInfo - React 错误信息
   * @param reset - 重置错误状态的函数
   */
  fallback?: (error: Error, errorInfo: React.ErrorInfo, reset: () => void) => ReactNode;
  /**
   * 错误回调函数
   */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /**
   * 自定义重置逻辑的钩子
   */
  onReset?: () => void;
  /**
   * 重置键 - 当此值改变时，自动重置错误状态
   *
   * @example
   * ```tsx
   * const [userId, setUserId] = useState('user1');
   *
   * <FilterProvider
   *   instance={filter}
   *   resetKeys={[userId]} // 当 userId 改变时自动重置错误
   * >
   *   <UserProfile userId={userId} />
   * </FilterProvider>
   * ```
   */
  resetKeys?: Array<string | number>;
}

export interface UseFilterInput<TDraft extends Draft = Draft> {
  instance?: FilterApi<TDraft>;
  namespace?: string;
}

export interface UseFieldOptions<TDraft extends Draft = Draft> {
  instance?: FilterApi<TDraft>;
  namespace?: string;
}

export interface UseOptionsInput<TDraft extends Draft = Draft> extends UseFilterInput<TDraft> {
  path: string;
  keyword?: string;
}
