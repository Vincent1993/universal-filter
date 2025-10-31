import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode, ReactElement } from 'react';
import { DynamicFilterProvider } from '../src/provider/DynamicFilterProvider';
import { useFilterRegistry } from '../src/hooks/useFilterRegistry';
import { useSchemaField } from '../src/hooks/useSchemaField';
import { useDynamicFields } from '../src/hooks/useDynamicFields';
import type { FilterApi } from '@dfx/universal-filter';

const filterConfigs = [
  {
    id: 'filter:text',
    name: 'Text filter',
    schema: { type: 'string' }
  },
  {
    id: 'filter:status',
    name: 'Status filter',
    schema: { type: 'string' }
  }
];

function createWrapper(): ({ children }: { children: ReactNode }) => ReactElement {
  return function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return (
      <DynamicFilterProvider filterConfigs={filterConfigs} components={{}}>
        {children}
      </DynamicFilterProvider>
    );
  };
}

describe('useFilterRegistry', () => {
  it('throws if used outside of DynamicFilterProvider', () => {
    expect(() => renderHook(() => useFilterRegistry())).toThrowError(
      '[Dynamic Filter] useFilterRegistry 必须在 DynamicFilterProvider 内部使用'
    );
  });

  it('provides access to registered configs', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useFilterRegistry(), { wrapper });

    expect(result.current.getById('filter:text')?.name).toBe('Text filter');
    expect(result.current.getAll()).toHaveLength(2);
  });
});

describe('useSchemaField', () => {
  it('throws if used outside of DynamicFilterProvider', () => {
    expect(() => renderHook(() => useSchemaField())).toThrowError(
      '[Dynamic Filter] useSchemaField 必须在 DynamicFilterProvider 内部使用'
    );
  });

  it('returns the registered SchemaField component', () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSchemaField(), { wrapper });

    expect(typeof result.current).toBe('function');
  });
});

describe('useDynamicFields', () => {
  const serverSchema = {
    type: 'object',
    properties: {
      keyword: {
        type: 'string',
        'x-component-id': 'filter:text'
      },
      status: {
        type: 'string',
        'x-component-id': 'filter:status'
      }
    }
  };

  it('manages active fields, schema and available fields', () => {
    const wrapper = createWrapper();
    const filter = {
      form: {
        clearFormGraph: vi.fn(),
        deleteValuesIn: vi.fn()
      }
    } as unknown as FilterApi;
    const { result } = renderHook(
      () =>
        useDynamicFields({
          filter,
          serverSchema,
          defaultFields: ['filter:text', 'filter:text']
        }),
      { wrapper }
    );

    expect(result.current.activeFields).toEqual(['filter:text']);
    expect(Object.keys(result.current.activeSchema.properties ?? {})).toEqual([
      'keyword'
    ]);
    expect(result.current.availableFields.map(field => field.id)).toEqual([
      'filter:status'
    ]);

    act(() => {
      result.current.addField('filter:status');
    });

    expect(result.current.activeFields).toEqual(['filter:text', 'filter:status']);
    expect(Object.keys(result.current.activeSchema.properties ?? {})).toEqual([
      'keyword',
      'status'
    ]);
    expect(result.current.availableFields).toEqual([]);

    act(() => {
      result.current.removeField('filter:text');
    });

    expect(result.current.activeFields).toEqual(['filter:status']);
    expect(filter.form.clearFormGraph).toHaveBeenCalledWith('keyword');
    expect(filter.form.deleteValuesIn).toHaveBeenCalledWith('keyword');
  });

  it('resets and sets fields with cleanup for removed ids', () => {
    const wrapper = createWrapper();
    const filter = {
      form: {
        clearFormGraph: vi.fn(),
        deleteValuesIn: vi.fn()
      }
    } as unknown as FilterApi;

    const { result } = renderHook(
      () =>
        useDynamicFields({
          filter,
          serverSchema,
          defaultFields: ['filter:text']
        }),
      { wrapper }
    );

    act(() => {
      result.current.addField('filter:status');
    });

    act(() => {
      result.current.setFields([
        'filter:status',
        'filter:text',
        'filter:status'
      ]);
    });

    expect(result.current.activeFields).toEqual(['filter:status', 'filter:text']);

    filter.form.clearFormGraph.mockClear();
    filter.form.deleteValuesIn.mockClear();

    act(() => {
      result.current.setFields(['filter:status']);
    });

    expect(result.current.activeFields).toEqual(['filter:status']);
    expect(filter.form.clearFormGraph).toHaveBeenCalledWith('keyword');
    expect(filter.form.deleteValuesIn).toHaveBeenCalledWith('keyword');

    filter.form.clearFormGraph.mockClear();
    filter.form.deleteValuesIn.mockClear();

    act(() => {
      result.current.resetFields();
    });

    expect(result.current.activeFields).toEqual(['filter:text']);
    expect(filter.form.clearFormGraph).toHaveBeenCalledWith('status');
    expect(filter.form.deleteValuesIn).toHaveBeenCalledWith('status');
  });
});
