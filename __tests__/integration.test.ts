import { describe, it, expect, vi } from 'vitest';
import { createFilter } from '../src/core/createFilter.js';
import { createDataPipeline } from '../src/core/pipeline.js';
import { createMemoryAdapter } from '../src/adapters/memoryAdapter.js';
import { createHistoryPlugin } from '../src/plugins/historyPlugin.js';
import { createMemoryPresetStorage, createPresetPlugin } from '../src/plugins/presetPlugin.js';
import { createUrlSyncPlugin } from '../src/plugins/urlSyncPlugin.js';

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

describe('Integration Tests', () => {
  describe('Filter + Pipeline + Adapter', () => {
    it('should coordinate pipeline encoding with adapter persistence', async () => {
      const pipeline = createDataPipeline([
        {
          name: 'encode-api',
          encode: (draft) => ({
            filters: {
              keyword: draft.keyword,
              status: draft.status,
            },
            pagination: {
              page: draft.page,
            },
          }),
        },
      ]);

      const filter = createFilter({
        defaultValues: { keyword: '', status: 'all', page: 1 },
        pipeline,
      });

      const adapter = createMemoryAdapter(filter);

      filter.getField('keyword').setValue('laptop');
      filter.getField('status').setValue('active');
      filter.getField('page').setValue(2);
      await filter.apply();

      const snapshot = adapter.getSnapshot();
      expect(snapshot.applied).toEqual({
        filters: { keyword: 'laptop', status: 'active' },
        pagination: { page: 2 },
      });
    });

    it('should adapt memory storage to filter lifecycle', () => {
      const filter = createFilter({
        defaultValues: { search: '', count: 0 },
      });

      const adapter = createMemoryAdapter(filter);
      const snapshots: any[] = [];

      adapter.subscribe((snapshot) => {
        snapshots.push(snapshot);
      });

      filter.getField('search').setValue('test');
      filter.getField('count').setValue(5);

      expect(snapshots.length).toBeGreaterThan(1);
      expect(snapshots[snapshots.length - 1].draft.search).toBe('test');
      expect(snapshots[snapshots.length - 1].draft.count).toBe(5);

      adapter.dispose();
    });
  });

  describe('Multiple Plugins', () => {
    it('should coordinate history plugin with preset plugin', async () => {
      const historyPlugin = createHistoryPlugin({
        limit: 10,
        onHistoryChange: vi.fn(),
      });

      const storage = createMemoryPresetStorage();
      const presetPlugin = createPresetPlugin({ storage, namespace: 'test' });

      const filter = createFilter({
        defaultValues: { value: 0 },
        plugins: [historyPlugin, presetPlugin],
      });

      filter.getField('value').setValue(1);
      filter.getField('value').setValue(2);
      await filter.apply();

      const state = filter.getPluginState('preset-plugin-key');
      expect(state).toBeDefined();
    });

    it('should work with URL sync and history plugins together', async () => {
      let urlState = '?status=draft';
      const historyChanges: any[] = [];

      const adapter = {
        read: () => urlState,
        write: (search: string) => {
          urlState = search;
        },
        subscribe: () => () => {},
      };

      const historyPlugin = createHistoryPlugin({
        onHistoryChange: (history) => historyChanges.push(history),
      });

      const urlPlugin = createUrlSyncPlugin({
        adapter,
        deserialize: (params) => ({
          status: (params.status as string) || 'all',
        }),
      });

      const filter = createFilter({
        defaultValues: { status: 'all' },
        plugins: [historyPlugin, urlPlugin],
      });

      expect(filter.draft.status).toBe('draft');

      filter.getField('status').setValue('active');
      await filter.apply();

      expect(historyChanges.length).toBeGreaterThan(0);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle groups with pipeline and plugins', async () => {
      const pipeline = createDataPipeline([
        {
          name: 'encode-request',
          encode: (draft) => ({
            basic: { keyword: draft.keyword },
            advanced: { category: draft.category, price: draft.price },
          }),
        },
      ]);

      const historyPlugin = createHistoryPlugin();

      const filter = createFilter({
        defaultValues: { keyword: '', category: '', price: 0 },
        groups: [
          { id: 'basic-group', fields: ['keyword'] },
          { id: 'advanced-group', fields: ['category', 'price'] },
        ],
        pipeline,
        plugins: [historyPlugin],
      });

      filter.getField('keyword').setValue('phone');
      filter.getField('category').setValue('electronics');
      filter.getField('price').setValue(1000);

      await filter.apply();

      const groups = filter.getGroups();
      expect(groups).toHaveLength(2);

      filter.reset('group', 'basic-group');
      expect(filter.draft.keyword).toBe('');
      expect(filter.draft.category).toBe('electronics');
    });

    it('should handle headless root with data shards and adapter', () => {
      const filter = createFilter({
        defaultValues: { search: '', page: 1, pageSize: 20 },
      });

      const adapter = createMemoryAdapter(filter);

      const searchShard = filter.registerDataShard({
        id: 'search',
        selector: (state) => ({ search: state.draft.search }),
      });

      const paginationRoot = filter.createHeadlessRoot({
        selector: (draft) => ({ page: draft.page, pageSize: draft.pageSize }),
      });

      const changes: any[] = [];
      adapter.subscribe((snapshot) => changes.push(snapshot));

      filter.getField('search').setValue('laptop');
      filter.getField('page').setValue(2);

      expect(searchShard.getSnapshot().search).toBe('laptop');
      expect(paginationRoot.getSnapshot()).toEqual({ page: 2, pageSize: 20 });

      paginationRoot.setSnapshot({ page: 5, pageSize: 50 });
      expect(filter.draft.page).toBe(5);
      expect(filter.draft.pageSize).toBe(50);

      searchShard.dispose();
      paginationRoot.dispose();
      adapter.dispose();
    });

    it('should handle apply with listeners and plugins', async () => {
      const listeners = {
        onApplyStart: vi.fn(),
        onApplySuccess: vi.fn(),
        onDraftChange: vi.fn(),
      };

      const plugin = {
        name: 'test-plugin',
        onAfterApply: vi.fn(),
      };

      const filter = createFilter({
        defaultValues: { value: 0 },
        listeners,
        plugins: [plugin],
      });

      filter.getField('value').setValue(1);
      expect(listeners.onDraftChange).toHaveBeenCalled();

      await filter.apply();

      expect(listeners.onApplyStart).toHaveBeenCalled();
      expect(listeners.onApplySuccess).toHaveBeenCalled();
      expect(plugin.onAfterApply).toHaveBeenCalled();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle errors gracefully', async () => {
      const transform = () => {
        throw new Error('Transform failed');
      };

      const onError = vi.fn();

      const filter = createFilter({
        defaultValues: { value: 1 },
        transform: transform as any,
        listeners: {
          onApplyError: onError,
        },
      });

      filter.getField('value').setValue(2);

      try {
        await filter.apply();
      } catch (e) {
        // Expected error
      }

      expect(onError).toHaveBeenCalled();
    });

    it('should preserve state on error', async () => {
      const transform = () => {
        throw new Error('Transform failed');
      };

      const filter = createFilter({
        defaultValues: { value: 1 },
        transform: transform as any,
      });

      const originalDraft = { ...filter.draft };
      filter.getField('value').setValue(2);

      try {
        await filter.apply();
      } catch (e) {
        // Expected
      }

      expect(filter.draft.value).toBe(2);
    });
  });
});
