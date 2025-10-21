import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFilter } from '../src/core/createFilter.js';
import { createDataPipeline } from '../src/core/pipeline.js';
import { createInstanceRegistry, registerInstances } from '../src/core/registry.js';
import { FilterError, ERROR_CODES } from '../src/core/errors.js';
import type { FilterApi, Plugin } from '../src/core/types.js';

vi.mock('@formily/core', () => {
  const listeners: Record<string, Array<(...args: any[]) => void>> = {};
  const fields = new Map<string, any>();
  const form = {
    values: {} as Record<string, any>,
    setValues(values: any) {
      this.values = { ...values } as Record<string, any>;
      listeners.form?.forEach((fn) => fn());
    },
    async validate() {
      return Promise.resolve();
    },
    setFieldValue(path: string, value: any) {
      this.values[path] = value;
      const field = fields.get(path) ?? { value: undefined, initialValue: undefined };
      field.value = value;
      fields.set(path, field);
      listeners[`field:${path}`]?.forEach((fn) => fn({ ...field, path }));
      listeners['field:*']?.forEach((fn) => fn({ ...field, path }));
      listeners.form?.forEach((fn) => fn());
    },
    getValuesIn(path: string) {
      if (!path) return this.values;
      return path.split('.').reduce((acc: any, key: any) => acc?.[key], this.values);
    },
    setFieldState(path: string, cb: (field: any) => void) {
      const field = fields.get(path) ?? {
        value: this.values[path],
        initialValue: undefined,
        display: 'visible',
        visible: true,
        disabled: false,
        validating: false,
        loading: false,
        selfErrors: [],
        errors: [],
      };
      fields.set(path, field);
      cb(field);
    },
    setFormState(cb: (state: any) => void) {
      cb({});
    },
    addEffects(_id: string, register: (form: any) => void) {
      register(this);
    },
    onFormValuesChange(cb: () => void) {
      listeners.form = listeners.form ?? [];
      listeners.form.push(cb);
      return () => {
        listeners.form = (listeners.form ?? []).filter((fn) => fn !== cb);
      };
    },
    onFieldValueChange(pattern: string, cb: (field: any) => void) {
      listeners[`field:${pattern}`] = listeners[`field:${pattern}`] ?? [];
      listeners[`field:${pattern}`]!.push(cb);
      return () => {
        listeners[`field:${pattern}`] = (listeners[`field:${pattern}`] ?? []).filter((fn) => fn !== cb);
      };
    },
  };

  return {
    createForm: () => form,
  };
});

vi.mock('@formily/json-schema', () => ({
  ISchema: {} as unknown,
}));

describe('Core Module', () => {
  describe('createFilter', () => {
    it('should create filter instance with default values', () => {
      const filter = createFilter({
        defaultValues: { search: '', status: 'all' },
      });

      expect(filter.draft).toEqual({ search: '', status: 'all' });
      expect(filter.applied).toEqual({ search: '', status: 'all' });
      expect(filter.validating).toBe(false);
      expect(filter.id).toBeDefined();
    });

    it('should generate unique IDs for different instances', () => {
      const filter1 = createFilter({ defaultValues: { a: 1 } });
      const filter2 = createFilter({ defaultValues: { a: 1 } });

      expect(filter1.id).not.toBe(filter2.id);
    });
  });

  describe('Field Operations', () => {
    let filter: FilterApi<{ search: string; status: string }>;

    beforeEach(() => {
      filter = createFilter({
        defaultValues: { search: '', status: 'all' },
      });
    });

    it('should get field and set value', () => {
      const field = filter.getField('search');
      expect(field.name).toBe('search');
      expect(field.value).toBe('');

      field.setValue('test');
      expect(filter.draft.search).toBe('test');
    });

    it('should handle field state', async () => {
      const field = filter.getField('search');
      const state = field.getState();

      expect(state.value).toBe('');
      expect(state.disabled).toBe(false);
      expect(state.displayed).toBe(true);
    });

    it('should reset field to default', () => {
      filter.getField('search').setValue('test');
      expect(filter.draft.search).toBe('test');

      filter.reset('search');
      expect(filter.draft.search).toBe('');
    });
  });

  describe('Groups', () => {
    it('should manage field groups', () => {
      const filter = createFilter({
        defaultValues: { a: 1, b: 2, c: 3 },
        groups: [
          { id: 'group1', fields: ['a', 'b'] },
          { id: 'group2', fields: ['c'] },
        ],
      });

      const groups = filter.getGroups();
      expect(groups).toHaveLength(2);
      expect(groups[0].id).toBe('group1');
      expect(groups[0].fields).toEqual(['a', 'b']);
    });

    it('should reset group', () => {
      const filter = createFilter({
        defaultValues: { a: 1, b: 2, c: 3 },
        groups: [
          { id: 'group1', fields: ['a', 'b'] },
        ],
      });

      filter.getField('a').setValue(10);
      filter.getField('b').setValue(20);
      filter.reset('group', 'group1');

      expect(filter.draft.a).toBe(1);
      expect(filter.draft.b).toBe(2);
      expect(filter.draft.c).toBe(3);
    });

    it('should throw error for non-existent group', () => {
      const filter = createFilter({
        defaultValues: { a: 1 },
        groups: [{ id: 'group1', fields: ['a'] }],
      });

      expect(() => filter.reset('group', 'nonexistent')).toThrow();
    });
  });

  describe('Subscriptions', () => {
    it('should subscribe to state changes', () => {
      const filter = createFilter({
        defaultValues: { search: '' },
      });

      const changes: any[] = [];
      const unsubscribe = filter.subscribe((state) => {
        changes.push(state);
      });

      expect(changes).toHaveLength(1);

      filter.getField('search').setValue('test');
      expect(changes).toHaveLength(2);
      expect(changes[1].draft.search).toBe('test');

      unsubscribe();
    });

    it('should handle multiple subscriptions', () => {
      const filter = createFilter({
        defaultValues: { value: 0 },
      });

      const listener1 = vi.fn();
      const listener2 = vi.fn();

      filter.subscribe(listener1);
      filter.subscribe(listener2);

      filter.getField('value').setValue(1);

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe('Data Pipeline', () => {
    it('should encode through pipeline stages', () => {
      const pipeline = createDataPipeline([
        {
          name: 'stage1',
          encode: (payload) => ({ ...payload, encoded: true }),
        },
        {
          name: 'stage2',
          encode: (payload) => ({ ...payload, stage2: true }),
        },
      ]);

      const result = pipeline.encode({ a: 1 }, { root: {} as any });
      expect(result).toEqual({ a: 1, encoded: true, stage2: true });
    });

    it('should decode through pipeline stages in reverse', () => {
      const pipeline = createDataPipeline([
        {
          name: 'stage1',
          decode: (payload) => ({ ...payload, stage1Decoded: true }),
        },
        {
          name: 'stage2',
          decode: (payload) => ({ ...payload, stage2Decoded: true }),
        },
      ]);

      const result = pipeline.decode({ a: 1 }, { root: {} as any });
      expect(result).toEqual({ a: 1, stage2Decoded: true, stage1Decoded: true });
    });

    it('should extend pipeline with new stage', () => {
      const pipeline = createDataPipeline([
        {
          name: 'stage1',
          encode: (p) => ({ ...p, s1: true }),
        },
      ]);

      const extended = pipeline.extend({
        name: 'stage2',
        encode: (p) => ({ ...p, s2: true }),
      });

      const result = extended.encode({ a: 1 }, { root: {} as any });
      expect(result).toEqual({ a: 1, s1: true, s2: true });
    });
  });

  describe('Apply & Reset', () => {
    it('should apply with listeners', async () => {
      const onApplyStart = vi.fn();
      const onApplySuccess = vi.fn();

      const filter = createFilter({
        defaultValues: { search: '' },
        listeners: {
          onApplyStart,
          onApplySuccess,
        },
      });

      filter.getField('search').setValue('test');
      await filter.apply();

      expect(onApplyStart).toHaveBeenCalledWith({ draft: { search: 'test' } });
      expect(onApplySuccess).toHaveBeenCalled();
    });

    it('should reset all fields', () => {
      const filter = createFilter({
        defaultValues: { a: 1, b: 2 },
      });

      filter.getField('a').setValue(10);
      filter.getField('b').setValue(20);
      filter.reset();

      expect(filter.draft).toEqual({ a: 1, b: 2 });
    });

    it('should clear errors', () => {
      const filter = createFilter({
        defaultValues: { a: 1 },
      });

      filter.getField('a').setState((field) => {
        field.errors = ['Error message'];
      });

      filter.clearErrors('a');
      expect(filter.getField('a').error).toBeUndefined();
    });
  });

  describe('Instance Registry', () => {
    it('should create and get registry', () => {
      const registry = createInstanceRegistry<{ a: number }>();
      const filter1 = createFilter<{ a: number }>({ defaultValues: { a: 1 } });

      registry.set('filter1', filter1);
      expect(registry.get('filter1')).toBe(filter1);
    });

    it('should set and get default instance', () => {
      const registry = createInstanceRegistry<{ a: number }>();
      const filter1 = createFilter<{ a: number }>({ defaultValues: { a: 1 } });

      registry.setDefault(filter1);
      expect(registry.getDefault()).toBe(filter1);
    });

    it('should register multiple instances', () => {
      const registry = createInstanceRegistry<{ a: number }>();
      const filter1 = createFilter<{ a: number }>({ defaultValues: { a: 1 } });
      const filter2 = createFilter<{ a: number }>({ defaultValues: { a: 2 } });

      registerInstances(registry, [
        { namespace: 'first', instance: filter1, makeDefault: true },
        { namespace: 'second', instance: filter2 },
      ]);

      expect(registry.get('first')).toBe(filter1);
      expect(registry.get('second')).toBe(filter2);
      expect(registry.getDefault()).toBe(filter1);
    });

    it('should get registry keys', () => {
      const registry = createInstanceRegistry<{ a: number }>();
      const filter1 = createFilter<{ a: number }>({ defaultValues: { a: 1 } });
      const filter2 = createFilter<{ a: number }>({ defaultValues: { a: 2 } });

      registry.set('first', filter1);
      registry.set('second', filter2);

      const keys = registry.keys();
      expect(keys).toContain('first');
      expect(keys).toContain('second');
    });
  });

  describe('Plugin System', () => {
    it('should call plugin hooks', async () => {
      const onInit = vi.fn();
      const onAfterApply = vi.fn();

      const plugin: Plugin = {
        name: 'test-plugin',
        onInit,
        onAfterApply,
      };

      const filter = createFilter({
        defaultValues: { a: 1 },
        plugins: [plugin],
      });

      expect(onInit).toHaveBeenCalledWith({ root: filter });

      await filter.apply();
      expect(onAfterApply).toHaveBeenCalled();
    });

    it('should manage plugin state', () => {
      const plugin: Plugin = {
        name: 'state-plugin',
        onInit({ root }) {
          root.setPluginState('test-key', { value: 'test' });
        },
      };

      const filter = createFilter({
        defaultValues: { a: 1 },
        plugins: [plugin],
      });

      const state = filter.getPluginState('test-key');
      expect(state).toEqual({ value: 'test' });
    });
  });

  describe('Error Handling', () => {
    it('should throw FilterError with correct code', () => {
      const error = new FilterError(ERROR_CODES.GROUP_NOT_FOUND, 'Test message');
      expect(error.code).toBe(ERROR_CODES.GROUP_NOT_FOUND);
      expect(error.message).toBe('Test message');
    });

    it('should identify FilterError instances', () => {
      const error = new FilterError(ERROR_CODES.NO_FILTER_CONTEXT);
      expect(error instanceof FilterError).toBe(true);
    });
  });
});
