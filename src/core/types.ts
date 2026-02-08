import type { Form, GeneralField, IFormProps } from '@formily/core';
import type { ISchema } from '@formily/json-schema';
import type { ReactNode } from 'react';
import type { CoreManager } from './managers';
import type { PluginManager } from './managers/PluginManager';
import type { OptionsRuntimeConfig } from '../hooks/useOptions/types';
import type { FilterHooks, FilterHookMap } from './hooks';

export type Draft = Record<string, any>;
export type JsonRecord = Record<string, unknown>;

export interface PluginDisposeError {
  name: string;
  error: unknown;
}

/**
 * apply:success 事件的 payload 类型
 */
export interface ApplySuccessPayload<TDraft extends Draft = Draft> {
  /** 当前草稿数据（响应式对象） */
  draft: TDraft;
  /** 转换后的 applied 数据 */
  applied: TDraft;
}

/**
 * FilterEventMap - 事件名到 payload 类型的映射
 *
 * 使用冒号分隔的事件名（兼容旧 API）与 FilterHooks 的驼峰命名一一对应。
 */
export interface FilterEventMap<TDraft extends Draft = Draft> {
  'init': { root: FilterApi<TDraft> };
  'draft:change': { draft: TDraft; prev?: TDraft };
  'apply:start': { draft: TDraft };
  'apply:success': { draft: TDraft; payload: ApplySuccessPayload<TDraft> };
  'validate:failed': { draft: TDraft; errors: Form['errors'] };
  'reset': { scope: 'all' | 'group' | string; target?: string };
  'plugin:ready': { name: string; ready: boolean; error?: unknown };
  'plugins:ready': { ready: boolean };
  'plugins:attached': { total: number };
  'plugins:destroyed': { errors: PluginDisposeError[] };
  'destroy': { root: FilterApi<TDraft> };
  'ready': { root: FilterApi<TDraft> };
}

/**
 * 事件名 → hook 名的映射类型
 */
export type EventToHookName = {
  'init': 'init';
  'draft:change': 'draftChange';
  'apply:start': 'applyStart';
  'apply:success': 'applySuccess';
  'validate:failed': 'validateFailed';
  'reset': 'reset';
  'plugin:ready': 'pluginReady';
  'plugins:ready': 'pluginsReady';
  'plugins:attached': 'pluginsAttached';
  'plugins:destroyed': 'pluginsDestroyed';
  'destroy': 'destroy';
  'ready': 'ready';
};

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

export interface PluginInitContext<TDraft extends Draft = Draft> {
  /** Filter 实例，通过 filter.hooks.xxx.tap() 注册生命周期拦截 */
  filter: FilterApi<TDraft>;
  /** 插件管理器实例，用于访问/设置插件状态、检查就绪状态等 */
  pluginManager: PluginManager<TDraft>;
}

export interface Plugin<TDraft extends Draft = Draft> {
  name: string;
  /** 插件初始化，在此方法内通过 ctx.filter.hooks 注册所有需要的钩子 */
  onInit?(ctx: PluginInitContext<TDraft>): void | Promise<void>;
  /** 插件销毁 */
  onDestroy?(): void;
}

/**
 * 插件工厂函数辅助工具
 */
export interface PluginFactoryHelpers<TDraft extends Draft = Draft> {
  root: FilterApi<TDraft>;
  push: (plugin: Plugin<TDraft>) => void;
  shift: (plugin: Plugin<TDraft>) => void;
  remove: (pluginName: string) => void;
}

/**
 * 插件工厂类型：可以是插件对象或工厂函数
 */
export type PluginFactory<TDraft extends Draft = Draft> =
  | Plugin<TDraft>
  | ((helpers: PluginFactoryHelpers<TDraft>) => Plugin<TDraft> | void)

/**
 * FilterListeners - 用户级生命周期回调
 *
 * 这些回调在构造时被自动转化为 hook taps，
 * 是面向普通用户的简化 API。
 */
export interface FilterListeners<TDraft extends Draft = Draft> {
  onInit?(ctx: { root: FilterApi<TDraft> }): void;
  onDraftChange?(draft: TDraft, prev?: TDraft): void;
  onApplyStart?(ctx: { draft: TDraft }): void;
  onApplySuccess?(ctx: { draft: TDraft; payload: ApplySuccessPayload<TDraft> }): void;
  onValidateFailed?(ctx: { draft: TDraft; errors: Form['errors'] }): void;
  onReset?(ctx: { scope: 'all' | 'field' | 'group'; target?: string }): void;
  onDestroy?(ctx: { root: FilterApi<TDraft> }): void;
}

export interface FilterOptions<TDraft extends Draft = Draft> {
  values?: TDraft;
  defaultValues?: TDraft;
  listeners?: FilterListeners<TDraft>;
  plugins?: PluginFactory<TDraft>[];
  applyDebounceMs?: number;
  /**
   * @name Auto Apply
   * @description 当 onInit 为 true 时，会在 Filter 完全就绪时自动应用
   * @description 当 onChange 为 true 时，会在草稿数据发生变化时自动应用
   */
  autoApply?: {
    onInit?: boolean;
    onChange?: boolean;
  },
  /**
   * @name Formily Form 配置
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
  /** 设置数据源 */
  setDataSource(dataSource: unknown): void;
}

// FilterApi - 基于 Formily Form 的过滤器 API
export interface FilterApi<TDraft extends Draft = Draft>
  extends Omit<CoreManager<TDraft>, 'dispose'>,
    FilterEvents<TDraft> {
  /** 插件命名空间 */
  readonly plugin: PluginManager<TDraft>;

  /**
   * 统一钩子注册表（基于 tapable）
   *
   * 暴露给插件和高级用户，可通过 hooks.xxx.tap() 注册拦截器。
   * 这是整个系统的唯一事件源。
   */
  readonly hooks: FilterHooks<TDraft>;

  /** 销毁当前过滤器实例 */
  dispose(): void;

  /**
   * 过滤器是否已就绪（响应式属性）
   * 就绪 = 插件初始化完成 && 表单挂载完成
   */
  readonly ready: boolean;

  /**
   * 等待过滤器就绪的 Promise 封装
   * @param timeout - 超时时间（ms），默认无限等待
   */
  waitForReady(timeout?: number): Promise<void>;
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
  fallback?: (error: Error, errorInfo: React.ErrorInfo, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onReset?: () => void;
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
