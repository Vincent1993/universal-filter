import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFilter } from '../src/core/createFilter.js';
import type { FilterApi } from '../src/core/types.js';

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
      listeners.form?.forEach((fn) => fn());
    },
    getValuesIn(path: string) {
      if (!path) return this.values;
      return path.split('.').reduce((acc: any, key: any) => acc?.[key], this.values);
    },
    setFieldState(path: string, cb: (field: any) => void) {
      const field = fields.get(path) ?? { value: this.values[path] };
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
      return () => {};
    },
  };

  return {
    createForm: () => form,
  };
});

vi.mock('@formily/json-schema', () => ({
  ISchema: {} as unknown,
}));

describe('Advanced Features', () => {
  describe('Data Shards', () => {
    let filter: FilterApi<{ search: string; page: number; pageSize: number }>;

    beforeEach(() => {
      filter = createFilter({
        defaultValues: { search: '', page: 1, pageSize: 20 },
      });
    });

    it('should register data shard with selector', () => {
      const shard = filter.registerDataShard({
        id: 'pagination-shard',
        selector: (state) => ({
          page: state.draft.page,
          pageSize: state.draft.pageSize,
        }),
      });

      expect(shard.id).toBe('pagination-shard');
      expect(shard.getSnapshot()).toEqual({ page: 1, pageSize: 20 });
    });

    it('should notify shard subscribers on changes', () => {
      const shard = filter.registerDataShard({
        id: 'search-shard',
        selector: (state) => ({ search: state.draft.search }),
      });

      const changes: any[] = [];
      shard.subscribe((value) => changes.push(value));

      filter.getField('search').setValue('test');
      filter.getField('search').setValue('test2');

      expect(changes.length).toBeGreaterThan(1);
      expect(changes[changes.length - 1].search).toBe('test2');
    });

    it('should update filter through shard snapshot', () => {
      const shard = filter.registerDataShard({
        id: 'pagination-shard',
        selector: (state) => ({
          page: state.draft.page,
          pageSize: state.draft.pageSize,
        }),
      });

      shard.setSnapshot({ page: 5, pageSize: 50 });

      expect(filter.draft.page).toBe(5);
      expect(filter.draft.pageSize).toBe(50);
    });

    it('should handle shard disposal', () => {
      const shard = filter.registerDataShard({
        id: 'shard1',
        selector: (state) => state.draft,
      });

      shard.dispose();

      const listener = vi.fn();
      filter.subscribe(listener);
      filter.getField('search').setValue('test');

      expect(listener).toHaveBeenCalled();
    });

    it('should not notify after shard unsubscription', () => {
      const shard = filter.registerDataShard({
        id: 'shard1',
        selector: (state) => state.draft,
      });

      const listener = vi.fn();
      const unsubscribe = shard.subscribe(listener);

      unsubscribe();
      filter.getField('search').setValue('test');

      expect(listener).toHaveBeenCalledTimes(1); // Only initial call
    });
  });

  describe('Headless Roots', () => {
    let filter: FilterApi<{ search: string; page: number; pageSize: number }>;

    beforeEach(() => {
      filter = createFilter({
        defaultValues: { search: '', page: 1, pageSize: 20 },
      });
    });

    it('should create headless root with default selector', () => {
      const root = filter.createHeadlessRoot();

      expect(root.id).toBeDefined();
      expect(root.getSnapshot()).toEqual({ search: '', page: 1, pageSize: 20 });
    });

    it('should create headless root with custom selector', () => {
      const root = filter.createHeadlessRoot({
        selector: (draft) => ({ page: draft.page, pageSize: draft.pageSize }),
      });

      const snapshot = root.getSnapshot();
      expect(snapshot).toEqual({ page: 1, pageSize: 20 });
    });

    it('should notify root subscribers on changes', () => {
      const root = filter.createHeadlessRoot({
        selector: (draft) => ({ page: draft.page }),
      });

      const changes: any[] = [];
      root.subscribe((value) => changes.push(value));

      filter.getField('page').setValue(2);
      filter.getField('page').setValue(3);

      expect(changes.length).toBeGreaterThan(1);
    });

    it('should update filter through root snapshot', () => {
      const root = filter.createHeadlessRoot({
        selector: (draft) => ({ page: draft.page }),
        apply: (api, snapshot) => {
          api.load({ page: snapshot.page }, { mode: 'merge', decode: false });
        },
      });

      root.setSnapshot({ page: 5 });
      expect(filter.draft.page).toBe(5);
    });

    it('should handle multiple roots', () => {
      const root1 = filter.createHeadlessRoot({
        selector: (draft) => ({ search: draft.search }),
      });

      const root2 = filter.createHeadlessRoot({
        selector: (draft) => ({ page: draft.page }),
      });

      expect(root1.id).not.toBe(root2.id);
    });

    it('should dispose root correctly', () => {
      const root = filter.createHeadlessRoot({
        selector: (draft) => draft,
      });

      const listener = vi.fn();
      root.subscribe(listener);
      root.dispose();

      filter.getField('search').setValue('test');

      // Listener should not be called after dispose
      expect(listener).toHaveBeenCalledTimes(1); // Only initial call from immediate
    });

    it('should handle custom apply function in root', () => {
      const customApply = vi.fn();

      const root = filter.createHeadlessRoot({
        selector: (draft) => ({ page: draft.page }),
        apply: customApply,
      });

      root.setSnapshot({ page: 10 });

      expect(customApply).toHaveBeenCalledWith(filter, { page: 10 });
    });
  });

  describe('Load & Transform', () => {
    it('should load values in replace mode', () => {
      const filter = createFilter({
        defaultValues: { a: 1, b: 2 },
      });

      filter.load({ a: 10 }, { mode: 'replace', decode: false });

      expect(filter.draft.a).toBe(10);
      expect(filter.draft.b).toBeUndefined();
    });

    it('should load values in merge mode', () => {
      const filter = createFilter({
        defaultValues: { a: 1, b: 2 },
      });

      filter.load({ a: 10 }, { mode: 'merge', decode: false });

      expect(filter.draft.a).toBe(10);
      expect(filter.draft.b).toBe(2);
    });

    it('should apply transform function', async () => {
      const transform = vi.fn((input) => ({ ...input, transformed: true }));

      const filter = createFilter({
        defaultValues: { value: 1 },
        transform,
      });

      filter.getField('value').setValue(5);
      await filter.apply();

      expect(transform).toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    it('should validate all fields', async () => {
      const filter = createFilter({
        defaultValues: { email: '' },
      });

      await filter.validateAll();
      expect(filter.validating).toBe(false);
    });

    it('should handle validation during apply', async () => {
      const filter = createFilter({
        defaultValues: { value: 1 },
      });

      filter.getField('value').setValue(10);
      await filter.apply();

      expect(filter.applied).toBeDefined();
    });
  });

  describe('Field Reset Modes', () => {
    it('should reset field to default mode', () => {
      const filter = createFilter({
        defaultValues: { value: 1 },
      });

      filter.getField('value').setValue(10);
      filter.resetValue('value', undefined, 'default');

      expect(filter.draft.value).toBe(1);
    });

    it('should reset field to applied mode', async () => {
      const filter = createFilter({
        defaultValues: { value: 1 },
      });

      filter.getField('value').setValue(10);
      await filter.apply();

      filter.getField('value').setValue(20);
      filter.resetValue('value', undefined, 'applied');

      expect(filter.draft.value).toBe(10);
    });
  });

  describe('Options Registry', () => {
    it('should register option source', () => {
      const filter = createFilter({
        defaultValues: { status: '' },
      });

      const source = {
        key: ['status'],
        fetcher: async () => [
          { label: '活跃', value: 'active' },
          { label: '草稿', value: 'draft' },
        ],
      };

      filter.registerOptionSource('status', source);
      const retrieved = filter.getOptionSource('status');

      expect(retrieved?.key).toEqual(['status']);
    });

    it('should remove option source', () => {
      const filter = createFilter({
        defaultValues: { status: '' },
      });

      filter.registerOptionSource('status', {
        key: ['status'],
        fetcher: async () => [],
      });

      filter.removeOptionSource('status');
      expect(filter.getOptionSource('status')).toBeUndefined();
    });
  });
});
