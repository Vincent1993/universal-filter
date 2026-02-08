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

  /**
   * 预初始化阶段（在 Formily Form 创建之前同步执行）
   *
   * 用于在表单实例化之前修改 FilterOptions（如注入 URL 参数到 defaultValues）。
   * 此方法必须是同步的，因为它在构造函数中调用。
   *
   * **注意**：仅当插件以对象形式直接传入时生效，工厂函数形式的插件不支持此阶段。
   *
   * @param options - 当前的 FilterOptions（可能已被前序插件修改）
   * @returns 修改后的 FilterOptions
   *
   * @example
   * ```ts
   * const urlPlugin: Plugin = {
   *   name: 'url-sync',
   *   resolveOptions(options) {
   *     const params = parseUrlParams();
   *     return {
   *       ...options,
   *       defaultValues: { ...options.defaultValues, ...params },
   *     };
   *   },
   *   onInit({ filter }) { ... }
   * };
   * ```
   */
  resolveOptions?(options: FilterOptions<TDraft>): FilterOptions<TDraft>;

  /**
   * 插件初始化（在 Formily Form 创建之后异步执行）
   *
   * 在此方法内通过 `ctx.filter.hooks.xxx.tap()` 注册所有需要的钩子。
   * 初始化完成后必须调用 `ctx.pluginManager.markReady(name, true)` 标记就绪。
   *
   * @example
   * ```ts
   * onInit({ filter, pluginManager }) {
   *   filter.hooks.applySuccess.tap('my-plugin', (payload) => {
   *     console.log('Applied:', payload);
   *   });
   *   pluginManager.markReady('my-plugin', true);
   * }
   * ```
   */
  onInit?(ctx: PluginInitContext<TDraft>): void | Promise<void>;

  /** 插件销毁，释放资源 */
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

/**
 * Filter 实例配置选项
 *
 * @example
 * ```ts
 * const filter = createFilter<MyDraft>({
 *   defaultValues: { keyword: '', page: 1, sort: 'desc' },
 *   plugins: [createUrlSyncPlugin(), createCodecTransformPlugin({ ... })],
 *   autoApply: { onInit: true },
 *   applyDebounceMs: 300,
 *   listeners: {
 *     onApplySuccess: ({ payload }) => fetchData(payload.applied),
 *   },
 * });
 * ```
 */
export interface FilterOptions<TDraft extends Draft = Draft> {
  /**
   * 受控值（直接绑定 Formily Form.values）
   * 传入后 defaultValues 将只影响初始值，不影响当前值
   */
  values?: TDraft;

  /**
   * 默认值（同时设置 Formily 的 initialValues 和初始 values）
   * reset() 时会恢复到此值
   */
  defaultValues?: TDraft;

  /**
   * 生命周期回调（语法糖，内部自动转为 hooks taps）
   *
   * 适合简单场景。复杂场景建议直接使用 `filter.hooks.xxx.tap()`
   */
  listeners?: FilterListeners<TDraft>;

  /**
   * 插件列表
   *
   * 支持两种形式：
   * - 插件对象：`{ name, onInit?, onDestroy?, resolveOptions? }`
   * - 工厂函数：`(helpers) => Plugin | void`
   */
  plugins?: PluginFactory<TDraft>[];

  /**
   * apply() 防抖延迟（毫秒）
   * 设置后多次快速调用 apply() 只会执行最后一次
   */
  applyDebounceMs?: number;

  /**
   * 自动 apply 配置
   *
   * - `onInit: true`：Filter 就绪后自动执行一次 apply
   * - `onChange: true`：draft 变化时自动执行 apply（配合 applyDebounceMs 使用）
   */
  autoApply?: {
    onInit?: boolean;
    onChange?: boolean;
  };

  /**
   * Formily Form 额外配置（不包括 values/initialValues/effects）
   * @see https://core.formilyjs.org/zh-CN/api/entry/create-form#iformprops
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

/**
 * Filter 公开 API 接口
 *
 * 继承自 CoreManager（草稿管理、快照、验证）和 FilterEvents（on/off/once）。
 *
 * ## 核心属性
 *
 * | 属性 | 类型 | 说明 |
 * |------|------|------|
 * | `draft` | `TDraft` | 当前草稿状态（Formily 响应式） |
 * | `applied` | `TDraft \| undefined` | 最后一次 apply 的转换后快照 |
 * | `lastApplied` | `TDraft \| undefined` | 最后一次 apply 的未转换快照 |
 * | `previous` | `TDraft \| undefined` | apply 开始时的状态快照 |
 * | `ready` | `boolean` | 是否完全就绪（响应式） |
 * | `changed` | `boolean` | draft 是否与 defaultValues 不同 |
 * | `form` | `Form` | Formily Form 实例 |
 *
 * ## 核心方法
 *
 * | 方法 | 说明 |
 * |------|------|
 * | `apply()` | 验证 + 创建快照 + 触发转换 |
 * | `reset()` | 重置到 defaultValues |
 * | `setValue(path, value)` | 设置单个字段 |
 * | `setValues(values, strategy?)` | 批量设置字段 |
 * | `waitForReady(timeout?)` | 等待就绪的 Promise |
 * | `dispose()` | 销毁实例 |
 *
 * @example
 * ```ts
 * const filter = createFilter({ defaultValues: { keyword: '' } });
 *
 * // 修改草稿
 * filter.setValue('keyword', 'react');
 *
 * // 应用（触发验证 + 快照 + codec 转换）
 * await filter.apply();
 * console.log(filter.applied); // { keyword: 'react' }
 *
 * // 重置
 * filter.reset();
 * console.log(filter.draft); // { keyword: '' }
 *
 * // 通过 hooks 注册拦截器
 * filter.hooks.beforeApply.tap('guard', ({ draft }) => {
 *   if (!draft.keyword) return true; // 阻止空查询
 * });
 * ```
 */
export interface FilterApi<TDraft extends Draft = Draft>
  extends Omit<CoreManager<TDraft>, 'dispose'>,
    FilterEvents<TDraft> {
  /** 插件管理器，用于查询插件状态 */
  readonly plugin: PluginManager<TDraft>;

  /**
   * 统一钩子注册表（基于 tapable）
   *
   * 暴露给插件和高级用户，可通过 `hooks.xxx.tap()` 注册拦截器。
   * 也支持 tapable 的 `intercept()` 进行 AOP 式全局拦截。
   *
   * @see FilterHooks 完整钩子列表
   *
   * @example
   * ```ts
   * // 注册同步钩子
   * filter.hooks.draftChange.tap('logger', ({ draft }) => {
   *   console.log('Draft changed:', draft);
   * });
   *
   * // 注册异步瀑布流钩子（数据转换）
   * filter.hooks.processSnapshot.tapPromise('encode', async (snapshot) => {
   *   return await encode(snapshot);
   * });
   *
   * // 使用 intercept 做全局拦截
   * filter.hooks.draftChange.intercept({
   *   call: () => console.log('draftChange fired'),
   * });
   * ```
   */
  readonly hooks: FilterHooks<TDraft>;

  /**
   * 销毁实例，释放所有资源
   *
   * 触发顺序：plugin.dispose() → CoreManager.dispose() → hooks.destroy
   */
  dispose(): void;

  /**
   * 是否完全就绪（Formily 响应式属性）
   *
   * `true` = Form 已挂载 + 所有插件初始化完成
   *
   * 可配合 `@formily/reactive-react` 的 `observer` 在 UI 层自动追踪
   */
  readonly ready: boolean;

  /**
   * 等待就绪的 Promise 封装
   *
   * @param timeout - 超时毫秒数，不传则无限等待
   * @throws 超时时抛出 `Error('waitForReady timed out after Nms')`
   *
   * @example
   * ```ts
   * // 在测试中使用
   * const filter = createFilter({ ... });
   * await filter.waitForReady(5000);
   * expect(filter.ready).toBe(true);
   *
   * // 在 async 初始化流程中
   * const filter = createFilter({ ... });
   * try {
   *   await filter.waitForReady(10000);
   *   filter.apply();
   * } catch (e) {
   *   console.error('Filter 初始化超时');
   * }
   * ```
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
