import type { Form, GeneralField, IFormProps } from '@formily/core';
import type { ISchema } from '@formily/json-schema';
import type { ReactNode } from 'react';
import type { ICoreManager } from './managers';
import type { PluginManager } from './managers/PluginManager';

export type Draft = Record<string, unknown>;
export type JsonRecord = Record<string, unknown>;

export type QueryKey = ReadonlyArray<unknown>;

export interface OptionItem {
  label: string;
  value: unknown;
  [key: string]: unknown;
}

export interface OptionSource {
  key: QueryKey;
  fetcher: (ctx: { keyword?: string; draft: Draft }) => Promise<OptionItem[]>;
  enabled?: boolean | ((draft: Draft) => boolean);
  staleTime?: number;
  refetchOnMount?: boolean;
  placeholderData?: OptionItem[];
}

export interface OptionsResult {
  data: OptionItem[];
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
}

export interface SectionConfig {
  id: string;
  eager?: boolean;
  fields?: string[];
}

export interface FilterGroup {
  id: string;
  fields: string[];
}

export interface RegisteredSchema {
  name: string;
  schema: ISchema;
  meta?: Record<string, unknown>;
}

export interface SchemaRegistrar<TDraft = Draft> {
  name: string;
  registerSchema(args: { external?: JsonRecord; sections?: SectionConfig[] }): RegisteredSchema;
  afterRegister?(args: { root: FilterApi<TDraft>; schema: RegisteredSchema }): void;
  registerOptions?(args: { root: FilterApi<TDraft>; schema: RegisteredSchema }): void;
}

export interface TransformContext<TDraft = Draft> {
  root: FilterApi<TDraft>;
  schema?: RegisteredSchema;
}

export interface DataShardOptions<TDraft = Draft, TSlice = unknown> {
  id: string;
  selector: (state: { draft: TDraft; applied?: TDraft }) => TSlice;
  projector?: (root: FilterApi<TDraft>, slice: TSlice) => void;
  source?: 'draft' | 'applied';
  immediate?: boolean;
}

export interface DataShardHandle<TSlice = unknown> {
  id: string;
  getSnapshot(): TSlice;
  setSnapshot(next: TSlice): void;
  subscribe(listener: (value: TSlice) => void): () => void;
  dispose(): void;
}

export interface PipelineStage<TDraft = Draft, TPayload = unknown> {
  name: string;
  encode?: (input: TPayload, ctx: TransformContext<TDraft>) => TPayload;
  decode?: (input: TPayload, ctx: TransformContext<TDraft>) => TPayload;
}

export interface DataPipeline<TDraft = Draft> {
  encode(input: TDraft, ctx: TransformContext<TDraft>): unknown;
  decode(input: unknown, ctx: TransformContext<TDraft>): TDraft;
  extend(stage: PipelineStage<TDraft>): DataPipeline<TDraft>;
  addStage(stage: PipelineStage<TDraft>): DataPipeline<TDraft>;
}

// 事件总线类型
export interface FilterEventMap<TDraft = Draft> {
  'draft:change': { draft: TDraft; prev?: TDraft };
  'apply:start': { draft: TDraft };
  'apply:success': { draft: TDraft; payload: unknown };
  'validate:failed': { draft: TDraft; errors: Form['errors'] };
  'reset': { scope: 'all' | 'group' | string; target?: string };
  'schema:loaded': { schema: RegisteredSchema };
  'schema:change': { prev?: RegisteredSchema; next: RegisteredSchema };
  'plugin:ready': { name: string; ready: boolean; error?: unknown };
  'plugins:ready': { ready: boolean };
  'plugins:attached': { total: number };
  'destroy': {};
}

export interface FilterEvents<TDraft = Draft> {
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
export interface InternalFilterBus<TDraft = Draft> extends FilterEvents<TDraft> {
  emit<K extends keyof FilterEventMap<TDraft>>(event: K, payload: FilterEventMap<TDraft>[K]): void;
}

// 模块契约（后续模块化装配使用）
export interface ModuleContext<TDraft = Draft> {
  root: FilterApi<TDraft>;
  bus: InternalFilterBus<TDraft>;
  setReady(ready: boolean, err?: unknown): void;
  isReady(): boolean;
}

export interface Module<TDraft = Draft, TOptions = unknown> {
  readonly name: string;
  readonly namespace: string;
  readonly requires?: string[];
  init(ctx: ModuleContext<TDraft>, options?: TOptions): void | Promise<void>;
  getPublicApi(): unknown;
  dispose?(): void | Promise<void>;
}

export interface PluginInitContext<TDraft = Draft> {
  root: FilterApi<TDraft>;
  setReady(ready: boolean, error?: unknown): void;
  isReady(): boolean;
}

export interface Plugin<TDraft = Draft> {
  name: string;
  /**
   * 可选的依赖声明：该插件依赖的其他插件名称
   */
  requires?: string[];
  /**
   * 执行优先级：数值越小越先执行，越大越后执行（后执行者覆盖能力更强）
   */
  priority?: number;
  /**
   * 插件初始化，仅与插件自身相关。数据读写应通过 ctx.root 完成。
   */
  onInit?(ctx: PluginInitContext<TDraft>): void | Promise<void>;
  /**
   * 插件销毁
   */
  onDestroy?(ctx: { root: FilterApi<TDraft> }): void | Promise<void>;
}

export interface FilterListeners<TDraft = Draft> {
  onInit?(ctx: { root: FilterApi<TDraft> }): void;
  onSchemaLoaded?(ctx: {
    root: FilterApi<TDraft>;
    schema: RegisteredSchema;
  }): void;
  onDraftChange?(draft: TDraft, prev?: TDraft): void;
  onFieldChange?(path: string, value: unknown, prev: unknown): void;
  onApplyStart?(ctx: { draft: TDraft }): void;
  onApplySuccess?(ctx: { draft: TDraft; payload: unknown }): void;
  onApplyError?(err: unknown): void;
  onValidateFailed?(ctx: { draft: TDraft; errors: Form['errors'] }): void;
  onReset?(ctx: { scope: 'all' | 'field' | 'group'; target?: string }): void;
  onDestroy?(ctx: { root: FilterApi<TDraft> }): void;
}

export interface FilterOptions<TDraft = Draft> {
  values?: TDraft;
  defaultValues?: TDraft;
  schemaRegistrar?: SchemaRegistrar<TDraft>;
  external?: JsonRecord;
  sections?: SectionConfig[];
  listeners?: FilterListeners<TDraft>;
  plugins?: Plugin<TDraft>[];
  transform?: (input: TDraft, ctx: TransformContext<TDraft>) => unknown;
  pipeline?: DataPipeline<TDraft>;
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
  groups?: FilterGroup[];
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

// FieldApi - 包装 Formily GeneralField，添加额外的便捷属性
// 所有 Formily Field 的方法都可以通过这个 API 访问
export type FieldApi = GeneralField & {
  // 额外的便捷属性
  readonly visible: boolean;
  readonly error?: string;
  readonly meta: JsonRecord;
};

export interface HeadlessRootOptions<TDraft = Draft, TRoot = TDraft> {
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
export interface FilterApi<TDraft = Draft> extends ICoreManager<TDraft> {
  /** 插件命名空间 - 直接暴露 PluginManager 实例 */
  readonly plugin: PluginManager<TDraft>;

  // 预留：其他命名空间（schema/shard/options/group），逐步补齐
  // readonly schema?: SchemaManager<TDraft>;
  // readonly shard?: ShardManager<TDraft>;
  // readonly options?: OptionsManager<TDraft>;
  // readonly group?: GroupManager<TDraft>;
}

export interface GlobalDefaults<TDraft = Draft> {
  plugins?: Plugin<TDraft>[];
  listeners?: FilterListeners<TDraft>;
  transform?: (input: TDraft, ctx: TransformContext<TDraft>) => unknown;
  pipeline?: DataPipeline<TDraft>;
  strict?: boolean;
  applyDebounceMs?: number;
  groups?: FilterGroup[];
}

export interface InstanceRegistry<TDraft = Draft> {
  setDefault(instance: FilterApi<TDraft>): void;
  getDefault(): FilterApi<TDraft> | undefined;
  set(namespace: string, instance: FilterApi<TDraft>): void;
  get(namespace: string): FilterApi<TDraft> | undefined;
  delete(namespace: string): void;
  keys(): string[];
}

export interface FilterConfigureValue<TDraft = Draft> {
  defaults?: GlobalDefaults<TDraft>;
  registry?: InstanceRegistry<TDraft>;
  mergeStrategy?: {
    plugins?: 'prepend' | 'append';
    listeners?: 'shallow' | 'deep';
  };
}

export interface FilterConfigureProps<TDraft = Draft> {
  value: FilterConfigureValue<TDraft>;
  children?: ReactNode;
}

export interface FilterProviderProps<TDraft = Draft> {
  instance: FilterApi<TDraft>;
  namespace?: string;
  children?: ReactNode;
}

export interface UseFilterInput<TDraft = Draft> {
  instance?: FilterApi<TDraft>;
  namespace?: string;
}

export interface UseFieldOptions<TDraft = Draft> {
  instance?: FilterApi<TDraft>;
  namespace?: string;
}

export interface UseOptionsInput<TDraft = Draft> extends UseFilterInput<TDraft> {
  path: string;
  keyword?: string;
}
