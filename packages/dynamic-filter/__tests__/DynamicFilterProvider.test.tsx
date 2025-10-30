import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { DynamicFilterProvider } from '../src/provider/DynamicFilterProvider';
import { useSchemaField } from '../src/hooks/useSchemaField';
import { useFilterRegistry } from '../src/hooks/useFilterRegistry';

describe('DynamicFilterProvider', () => {
  const filterConfigs = [
    {
      id: 'filter:text',
      name: 'Text filter',
      schema: {
        type: 'void',
        properties: {
          input: {
            type: 'string'
          }
        }
      }
    }
  ];

  const components = {};

  afterEach(() => {
    cleanup();
  });

  function CaptureSchemaField({ spy }: { spy: (schemaField: unknown) => void }) {
    const SchemaField = useSchemaField();

    useEffect(() => {
      spy(SchemaField);
    });

    return null;
  }

  function CaptureRegistry({
    onValue
  }: {
    onValue: (registry: ReturnType<typeof useFilterRegistry>) => void;
  }) {
    const registry = useFilterRegistry();

    useEffect(() => {
      onValue(registry);
    }, [registry, onValue]);

    return null;
  }

  it('reuses SchemaField instance when no scope is provided', async () => {
    const spy = vi.fn();

    const { rerender } = render(
      <DynamicFilterProvider filterConfigs={filterConfigs} components={components}>
        <CaptureSchemaField spy={spy} />
      </DynamicFilterProvider>
    );

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1);
    });

    const firstSchemaField = spy.mock.calls[0][0];

    rerender(
      <DynamicFilterProvider filterConfigs={filterConfigs} components={components}>
        <CaptureSchemaField spy={spy} />
      </DynamicFilterProvider>
    );

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(2);
    });

    const secondSchemaField = spy.mock.calls[1][0];

    expect(secondSchemaField).toBe(firstSchemaField);
  });

  it('creates a new SchemaField instance when scope changes', async () => {
    const spy = vi.fn();

    const scopeA = { format: () => 'a' };
    const scopeB = { format: () => 'b' };

    const { rerender } = render(
      <DynamicFilterProvider
        filterConfigs={filterConfigs}
        components={components}
        scope={scopeA}
      >
        <CaptureSchemaField spy={spy} />
      </DynamicFilterProvider>
    );

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1);
    });

    const firstSchemaField = spy.mock.calls[0][0];

    rerender(
      <DynamicFilterProvider
        filterConfigs={filterConfigs}
        components={components}
        scope={scopeB}
      >
        <CaptureSchemaField spy={spy} />
      </DynamicFilterProvider>
    );

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(2);
    });

    const secondSchemaField = spy.mock.calls[1][0];

    expect(secondSchemaField).not.toBe(firstSchemaField);
  });

  it('builds a cached registry that normalizes category and search queries', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const registrySpy = vi.fn();

    render(
      <DynamicFilterProvider
        filterConfigs={[
          ...filterConfigs,
          {
            id: 'filter:status',
            name: 'Status filter',
            category: 'Meta',
            schema: { type: 'string' }
          },
          {
            // duplicate id to ensure override warning is emitted
            id: 'filter:status',
            name: 'Override status filter',
            category: 'META',
            schema: { type: 'string', enum: ['a', 'b'] }
          }
        ]}
        components={components}
      >
        <CaptureRegistry onValue={registrySpy} />
      </DynamicFilterProvider>
    );

    await waitFor(() => {
      expect(registrySpy).toHaveBeenCalledTimes(1);
    });

    const registry = registrySpy.mock.calls[0][0];
    const allConfigs = registry.getAll();

    expect(allConfigs).toHaveLength(2);
    expect(allConfigs[1]?.name).toBe('Override status filter');

    const metaConfigs = registry.getByCategory('meta');
    expect(metaConfigs).toHaveLength(1);
    expect(metaConfigs[0]?.id).toBe('filter:status');

    const searchResults = registry.search('status');
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0]?.name).toBe('Override status filter');

    const emptySearchResults = registry.search('   ');
    expect(emptySearchResults).toHaveLength(2);

    expect(warnSpy).toHaveBeenCalledWith(
      '[Dynamic Filter] 配置 id 重复，使用最后一次定义覆盖: filter:status'
    );

    warnSpy.mockRestore();
  });
});
