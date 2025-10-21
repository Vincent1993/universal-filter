import { createForm } from '@formily/core';
import { cloneDeep, merge, isEqual } from 'es-toolkit';
import type {
  DataPipeline,
  DataShardHandle,
  DataShardOptions,
  Draft,
  FieldApi,
  FilterApi,
  FilterGroup,
  FilterListeners,
  FilterOptions,
  HeadlessRoot,
  HeadlessRootOptions,
  LoadOptions,
  OptionSource,
  Plugin,
  RegisteredSchema,
  SchemaRegistrar,
  TransformContext,
} from './types';
import { OptionsRegistry } from './optionsRegistry';
import { createFieldApi } from './fieldHelpers';
import { ERROR_CODES, FilterError } from './errors';
import { getGlobalConfigure } from '../context/configure';
import { mergeListeners, mergePlugins } from './lifecycle';
import { compileSchema } from './schema';

interface InternalState<TDraft> {
  appliedDraft?: TDraft;
  appliedPayload?: unknown;
  registrar?: SchemaRegistrar<TDraft>;
  schema?: RegisteredSchema<TDraft>;
}

interface HeadlessRecord<TRoot> {
  snapshot: TRoot;
  listeners: Set<(value: TRoot) => void>;
  unsubscribe: () => void;
}

interface DataShardRecord<TSlice> {
  snapshot: TSlice;
  selector: (state: { draft: unknown; applied?: unknown }) => TSlice;
  projector: (root: FilterApi<unknown>, slice: TSlice) => void;
  listeners: Set<(value: TSlice) => void>;
  unsubscribe: () => void;
}

class StateManager<TDraft> {
  draft: TDraft;
  applied?: TDraft;
  validating = false;
  schema?: RegisteredSchema<TDraft>;
  private internalState: InternalState<TDraft> = {};

  constructor(defaultValues: TDraft) {
    this.draft = cloneDeep(defaultValues);
    this.applied = cloneDeep(defaultValues);
    this.internalState.appliedDraft = cloneDeep(defaultValues);
    this.internalState.appliedPayload = cloneDeep(defaultValues);
  }

  getAppliedDraft(): TDraft {
    return this.internalState.appliedDraft ?? this.draft;
  }

  getAppliedPayload(): unknown {
    return this.internalState.appliedPayload;
  }

  setApplied(draft: TDraft, payload: unknown): void {
    this.internalState.appliedDraft = cloneDeep(draft);
    this.internalState.appliedPayload = payload;
    this.applied = cloneDeep(draft);
  }

  getRegistrar(): SchemaRegistrar<TDraft> | undefined {
    return this.internalState.registrar;
  }

  setRegistrar(registrar: SchemaRegistrar<TDraft>): void {
    this.internalState.registrar = registrar;
  }
}

class GroupManager {
  private groups = new Map<string, FilterGroup>();

  setGroups(groups?: FilterGroup[]): void {
    this.groups.clear();
    if (!groups || groups.length === 0) return;
    for (const group of groups) {
      const uniqueFields = Array.from(new Set(group.fields)).filter(Boolean);
      this.groups.set(group.id, { id: group.id, fields: uniqueFields });
    }
  }

  getGroups(): FilterGroup[] {
    return Array.from(this.groups.values()).map((group) => ({
      id: group.id,
      fields: [...group.fields],
    }));
  }

  getGroupFields(id: string): string[] {
    const group = this.groups.get(id);
    if (!group) {
      throw new FilterError(ERROR_CODES.GROUP_NOT_FOUND, `Group ${id} is not registered`);
    }
    return group.fields;
  }
}

export class FilterController<TDraft extends Draft> implements FilterApi<TDraft> {
  readonly id: string;
  readonly form = createForm({ values: {} });
  readonly options = new OptionsRegistry();

  private readonly stateManager: StateManager<TDraft>;
  private readonly groupManager: GroupManager;
  private readonly roots = new Map<string, HeadlessRecord<unknown>>();
  private readonly shards = new Map<string, DataShardRecord<unknown>>();
  private readonly pluginState = new Map<string | symbol, unknown>();

  private listeners: FilterListeners<TDraft> | undefined;
  private plugins: Plugin<TDraft>[] = [];
  private defaultValues: TDraft;
  private readonly strict: boolean;
  private readonly transform?: (input: TDraft, ctx: TransformContext<TDraft>) => unknown;
  private readonly pipeline?: DataPipeline<TDraft>;
  private readonly applyDebounce: number;

  get draft(): TDraft {
    return this.stateManager.draft;
  }

  set draft(value: TDraft) {
    this.stateManager.draft = cloneDeep(value);
  }

  get applied(): TDraft | undefined {
    return this.stateManager.applied;
  }

  set applied(value: TDraft | undefined) {
    this.stateManager.applied = value ? cloneDeep(value) : undefined;
  }

  get validating(): boolean {
    return this.stateManager.validating;
  }

  set validating(value: boolean) {
    this.stateManager.validating = value;
  }

  get schema(): RegisteredSchema<TDraft> | undefined {
    return this.stateManager.schema;
  }

  set schema(value: RegisteredSchema<TDraft> | undefined) {
    this.stateManager.schema = value;
  }

  constructor(private readonly optionsConfig: FilterOptions<TDraft> = {}) {
    const configure = getGlobalConfigure<TDraft>();
    const defaults = configure.defaults ?? {};
    const mergeStrategy = configure.mergeStrategy ?? { plugins: 'append', listeners: 'shallow' };

    this.listeners = mergeListeners(defaults.listeners, optionsConfig.listeners, mergeStrategy.listeners ?? 'shallow');
    this.plugins = mergePlugins(defaults.plugins ?? [], optionsConfig.plugins ?? [], mergeStrategy.plugins ?? 'append');

    this.strict = optionsConfig.strict ?? defaults.strict ?? false;
    this.transform = optionsConfig.transform ?? defaults.transform;
    this.pipeline = optionsConfig.pipeline ?? defaults.pipeline;
    this.applyDebounce = optionsConfig.applyDebounceMs ?? defaults.applyDebounceMs ?? 0;

    this.defaultValues = cloneDeep((optionsConfig.defaultValues ?? {}) as TDraft);

    this.stateManager = new StateManager(this.defaultValues);
    this.groupManager = new GroupManager();

    this.id = `filter-${Math.random().toString(36).slice(2, 8)}`;

    this.form.setValues(cloneDeep(this.defaultValues));
    this.groupManager.setGroups(optionsConfig.groups ?? defaults.groups ?? convertSectionsToGroups(optionsConfig.sections));

    this.setupFormEffects();
    this.listeners?.onInit?.({ root: this });
    void this.runPluginsInit();

    if (optionsConfig.schemaRegistrar) {
      this.installSchema(optionsConfig.schemaRegistrar, 'reset');
    }
  }

  async apply(): Promise<void> {
    const snapshot = cloneDeep(this.form.values as TDraft);
    this.listeners?.onApplyStart?.({ draft: snapshot });

    try {
      this.validating = true;
      await this.form.validate();
    } catch (error) {
      this.listeners?.onApplyError?.(error);
      this.validating = false;
      throw error;
    }
    this.validating = false;

    if (this.applyDebounce > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.applyDebounce));
    }

    const ctx: TransformContext<TDraft> = { root: this, schema: this.schema };
    let payload: unknown = cloneDeep(snapshot);
    try {
      if (this.pipeline) {
        payload = this.pipeline.encode(cloneDeep(snapshot), ctx);
      }
      if (this.transform) {
        payload = this.transform(cloneDeep(payload as TDraft), ctx);
      }
    } catch (error) {
      this.listeners?.onApplyError?.(error);
      throw new FilterError(ERROR_CODES.CODEC_ENCODE_FAILED, 'Failed to transform filter payload');
    }

    this.stateManager.setApplied(snapshot, payload);
    this.notifyStateChange();
    this.listeners?.onApplySuccess?.({ draft: snapshot, payload });
    void this.runPluginsAfterApply({ draft: snapshot, payload });
  }

  reset(scope: 'all' | 'group' | string = 'all', target?: string): void {
    if (scope === 'all') {
      this.form.setValues(cloneDeep(this.defaultValues));
      this.draft = cloneDeep(this.defaultValues);
      this.listeners?.onReset?.({ scope: 'all' });
      this.notifyStateChange();
      return;
    }

    if (scope === 'group') {
      const id = ensureGroupId(target);
      this.resetGroup(id, 'default');
      this.listeners?.onReset?.({ scope: 'group', target: id });
      return;
    }

    const next = this.form.getValuesIn(scope);
    (this.form as any).setFieldValue(scope, cloneDeep(next ?? this.readAtPath(this.defaultValues, scope as string)));
    this.listeners?.onReset?.({ scope: 'field', target: scope });
    this.updateDraftFromForm();
  }

  resetValue(
    scope: 'all' | 'group' | string = 'all',
    target?: string,
    mode: 'initial' | 'default' | 'applied' = 'default'
  ): void {
    if (scope === 'group') {
      const id = ensureGroupId(target);
      const resolvedMode = resolveMode(undefined, mode);
      this.resetGroup(id, resolvedMode);
      return;
    }

    const resolvedMode = resolveMode(target as unknown as string | undefined, mode);
    const source = this.getSourceByMode(resolvedMode);

    if (scope === 'all') {
      this.form.setValues(cloneDeep(source));
      this.updateDraftFromForm();
      return;
    }

    const value = this.readAtPath(source, scope);
    (this.form as any).setFieldValue(scope, cloneDeep(value));
    this.updateDraftFromForm();
  }

  clearErrors(scope: 'all' | 'group' | string = 'all', target?: string): void {
    if (scope === 'all') {
      this.form.clearErrors();
      return;
    }

    if (scope === 'group') {
      const id = ensureGroupId(target);
      const fields = this.groupManager.getGroupFields(id);
      for (const fieldPath of fields) {
        this.form.clearErrors(fieldPath);
      }
      return;
    }

    this.form.clearErrors(scope);
  }

  validateAll(): Promise<void> {
    return this.form.validate();
  }

  registerOptionSource(path: string, source: OptionSource): void {
    this.options.register(path, source);
  }

  removeOptionSource(path: string): void {
    this.options.remove(path);
  }

  getOptionSource(path: string): OptionSource | undefined {
    return this.options.get(path);
  }

  getField(path: string): FieldApi {
    return createFieldApi(this.form, path);
  }

  subscribe(listener: (state: { draft: TDraft; applied?: TDraft }) => void): () => void {
    const subscriptionId = (this.form as any).subscribe('filterStateChange', (payload: unknown) => {
      if (payload && typeof payload === 'object' && 'draft' in payload) {
        listener(payload as { draft: TDraft; applied?: TDraft });
      }
    });
    return () => {
      if (typeof subscriptionId === 'number') {
        (this.form as any).unsubscribe(subscriptionId);
      }
    };
  }

  setSchemaRegistrar(registrar: SchemaRegistrar<TDraft>, mode: 'preserve' | 'reset' = 'reset'): void {
    this.installSchema(registrar, mode);
  }

  createHeadlessRoot<TRoot = TDraft>(options?: HeadlessRootOptions<TDraft, TRoot>): HeadlessRoot<TRoot> {
    const {
      id = `root-${Math.random().toString(36).slice(2, 8)}`,
      selector = ((draft) => draft as unknown as TRoot) as (draft: TDraft) => TRoot,
      apply,
      immediate = true,
    } = options ?? {};

    if (this.roots.has(id)) {
      throw new FilterError(ERROR_CODES.DUPLICATED_OBJECT, `HeadlessRoot with id "${id}" already exists`);
    }

    const listeners = new Set<(value: TRoot) => void>();
    let snapshot = cloneDeep(selector(this.draft));

    const notify = (value: TRoot) => {
      for (const listener of listeners) {
        listener(cloneDeep(value));
      }
    };

    const unsubscribe = this.subscribe((state) => {
      const next = cloneDeep(selector(state.draft));
      if (!isEqual(next, snapshot)) {
        snapshot = cloneDeep(next);
        notify(snapshot);
      }
    });

    const record: HeadlessRecord<TRoot> = {
      snapshot,
      listeners,
      unsubscribe,
    };
    this.roots.set(id, record as any);

    const root: HeadlessRoot<TRoot> = {
      id,
      getSnapshot: () => cloneDeep(snapshot),
      setSnapshot: (next) => {
        snapshot = cloneDeep(next);
        apply?.(this, cloneDeep(next));
      },
      subscribe: (listener) => {
        listeners.add(listener);
        if (immediate) {
          listener(cloneDeep(snapshot));
        }
        return () => {
          listeners.delete(listener);
        };
      },
      dispose: () => {
        const existing = this.roots.get(id);
        if (existing) {
          existing.unsubscribe();
          (existing as any).listeners.clear();
          this.roots.delete(id);
        }
      },
    };

    if (immediate) {
      notify(snapshot);
    }

    return root;
  }

  load(values: Partial<TDraft>, options: LoadOptions<TDraft> = {}): void {
    const mode = options.mode ?? 'replace';
    const decode = options.decode ?? true;
    const ctx: TransformContext<TDraft> = { root: this, schema: this.schema };
    let incoming: Partial<TDraft> = cloneDeep(values);

    if (decode && this.pipeline) {
      try {
        incoming = this.pipeline.decode(values as TDraft, ctx);
      } catch (error) {
        throw new FilterError(ERROR_CODES.CODEC_DECODE_FAILED, 'Failed to decode filter payload');
      }
    }

    if (mode === 'merge') {
      const merged = merge(cloneDeep(this.form.values as TDraft), incoming as Record<string, unknown>);
      this.form.setValues(cloneDeep(merged));
    } else {
      this.form.setValues(cloneDeep(incoming));
    }
    this.updateDraftFromForm();
  }

  getPipeline(): DataPipeline<TDraft> | undefined {
    return this.pipeline;
  }

  getGroups(): FilterGroup[] {
    return this.groupManager.getGroups();
  }

  registerDataShard<TSlice = unknown>(options: DataShardOptions<TDraft, TSlice>): DataShardHandle<TSlice> {
    const { id, selector, projector = defaultShardProjector, immediate = true } = options;
    if (!id) {
      throw new FilterError(ERROR_CODES.SHARD_NOT_FOUND, 'Data shard id is required');
    }

    this.disposeShard(id);

    const listeners = new Set<(value: TSlice) => void>();
    let snapshot = cloneDeep(selector({ draft: this.draft, applied: this.applied }));

    const notify = (value: TSlice) => {
      for (const listener of listeners) {
        listener(cloneDeep(value));
      }
    };

    const unsubscribe = this.subscribe((state) => {
      const next = cloneDeep(selector({ draft: state.draft, applied: state.applied }));
      if (!isEqual(next, snapshot)) {
        snapshot = cloneDeep(next);
        notify(snapshot);
      }
    });

    const record: DataShardRecord<TSlice> = {
      snapshot,
      selector: selector as (state: { draft: unknown; applied?: unknown }) => TSlice,
      projector: projector as (root: FilterApi<unknown>, slice: TSlice) => void,
      listeners,
      unsubscribe,
    };
    this.shards.set(id, record as any);

    const handle: DataShardHandle<TSlice> = {
      id,
      getSnapshot: () => cloneDeep(snapshot),
      setSnapshot: (next) => {
        snapshot = cloneDeep(next);
        projector(this, cloneDeep(next));
      },
      subscribe: (listener) => {
        listeners.add(listener);
        if (immediate) {
          listener(cloneDeep(snapshot));
        }
        return () => {
          listeners.delete(listener);
        };
      },
      dispose: () => {
        this.disposeShard(id);
      },
    };

    if (immediate) {
      notify(snapshot);
    }

    return handle;
  }

  getPluginState<TState = unknown>(key: string | symbol): TState | undefined {
    return this.pluginState.get(key) as TState | undefined;
  }

  setPluginState<TState = unknown>(key: string | symbol, value: TState | undefined): void {
    if (value === undefined) {
      this.pluginState.delete(key);
      return;
    }
    this.pluginState.set(key, value);
  }

  private setupFormEffects() {
    this.form.addEffects('filter-controller', (form: any) => {
      form.onFormValuesChange(() => {
        const previous = this.draft;
        this.draft = cloneDeep(form.values as TDraft);
        this.listeners?.onDraftChange?.(this.draft, previous);
        this.notifyStateChange();
      });
      form.onFieldValueChange('*', (field: any) => {
        const prev = field.modified ? field.modifiedValue : field.initialValue;
        this.listeners?.onFieldChange?.(field.path?.toString() ?? '', field.value, prev);
      });
    });
  }

  private notifyStateChange(): void {
    this.form.notify('filterStateChange', { draft: this.draft, applied: this.applied });
  }

  private async runPluginsInit(): Promise<void> {
    for (const plugin of this.plugins) {
      if (typeof plugin.onInit === 'function') {
        await plugin.onInit({ root: this });
      }
    }
  }

  private async runPluginsAfterApply(payload: { draft: TDraft; payload: unknown }): Promise<void> {
    for (const plugin of this.plugins) {
      if (typeof plugin.onAfterApply === 'function') {
        await plugin.onAfterApply({ root: this, ...payload });
      }
    }
  }

  private async runPluginsSchemaChange(
    prev: RegisteredSchema<TDraft>,
    next: RegisteredSchema<TDraft>
  ): Promise<void> {
    for (const plugin of this.plugins) {
      if (typeof plugin.onSchemaChange === 'function') {
        await plugin.onSchemaChange({ root: this, prev, next });
      }
    }
  }

  private updateDraftFromForm() {
    this.draft = cloneDeep(this.form.values as TDraft);
    this.notifyStateChange();
  }

  private installSchema(registrar: SchemaRegistrar<TDraft>, mode: 'preserve' | 'reset') {
    const nextSchema = registrar.registerSchema({
      external: this.optionsConfig.external,
      sections: this.optionsConfig.sections,
    });
    const compiled = compileSchema(nextSchema.schema, this.form, {
      strict: this.strict,
    });

    const previousSchema = this.schema;
    this.stateManager.setRegistrar(registrar);
    this.schema = { ...nextSchema, schema: compiled.schema };
    registrar.afterRegister?.({ root: this, schema: this.schema });
    registrar.registerOptions?.({ root: this, schema: this.schema });

    this.groupManager.setGroups(extractGroups(this.schema, this.optionsConfig));

    if (mode === 'reset') {
      this.form.setValues(cloneDeep(this.defaultValues));
      this.updateDraftFromForm();
    }

    if (previousSchema) {
      void this.runPluginsSchemaChange(previousSchema, this.schema);
    }

    this.listeners?.onSchemaLoaded?.({ root: this, schema: this.schema });
  }

  private getSourceByMode(mode: 'initial' | 'default' | 'applied'): TDraft {
    if (mode === 'applied') {
      return cloneDeep(this.stateManager.getAppliedDraft() ?? this.defaultValues);
    }
    return cloneDeep(this.defaultValues);
  }

  private resetGroup(id: string, mode: 'initial' | 'default' | 'applied') {
    const fields = this.groupManager.getGroupFields(id);
    const source = this.getSourceByMode(mode);
    for (const fieldPath of fields) {
      const value = this.readAtPath(source, fieldPath);
      (this.form as any).setFieldValue(fieldPath, cloneDeep(value));
    }
    this.updateDraftFromForm();
  }

  private disposeShard(id: string) {
    const existing = this.shards.get(id);
    if (existing) {
      existing.unsubscribe();
      (existing as any).listeners.clear();
      this.shards.delete(id);
    }
  }

  private readAtPath(source: unknown, path: string): unknown {
    if (!path) return source;
    return path.split('.').reduce((acc: unknown, key) => {
      if (acc === undefined || acc === null) {
        return undefined;
      }
      if (typeof acc === 'object') {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, source);
  }
}

function resolveMode(
  input: string | undefined,
  fallback: 'initial' | 'default' | 'applied'
): 'initial' | 'default' | 'applied' {
  if (input === 'initial' || input === 'default' || input === 'applied') {
    return input;
  }
  return fallback;
}

function ensureGroupId(id?: string): string {
  if (!id) {
    throw new FilterError(ERROR_CODES.GROUP_NOT_FOUND, 'Group id is required for group operations');
  }
  return id;
}

function convertSectionsToGroups(
  sections?: Array<{ id: string; fields?: string[] }>
): FilterGroup[] | undefined {
  if (!sections) return undefined;
  return sections.map((section) => ({ id: section.id, fields: section.fields ?? [] }));
}

function extractGroups<TDraft>(
  schema: RegisteredSchema<TDraft> | undefined,
  options: FilterOptions<TDraft>
): FilterGroup[] | undefined {
  const fromSchema = Array.isArray(schema?.meta?.groups)
    ? (schema?.meta?.groups as Array<{ id: string; fields?: string[] }>).map((group) => ({
        id: group.id,
        fields: group.fields ?? [],
      }))
    : undefined;
  if (fromSchema && fromSchema.length > 0) {
    return fromSchema;
  }
  if (options.groups && options.groups.length > 0) {
    return options.groups;
  }
  return convertSectionsToGroups(options.sections);
}

function defaultShardProjector<TDraft extends Draft>(root: FilterApi<TDraft>, slice: unknown) {
  root.load(slice as Partial<TDraft>, { mode: 'merge', decode: false });
}
