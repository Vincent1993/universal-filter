import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { Schema } from '@formily/json-schema';
import { createSchemaPatch } from '../src/core/schema-patch';
import type { FilterFieldConfig, FilterRegistry } from '../src/types';

function createRegistry(configs: FilterFieldConfig[]): FilterRegistry {
  const map = new Map<string, FilterFieldConfig>();
  configs.forEach(config => {
    map.set(config.id, config);
  });

  return {
    configs: map,
    getById: (id: string) => map.get(id),
    getAll: () => Array.from(map.values()),
    getByCategory: () => Array.from(map.values()),
    search: () => Array.from(map.values())
  };
}

describe('createSchemaPatch', () => {
  const registerSpy = vi.spyOn(Schema, 'registerPatches');
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    registerSpy.mockClear();
    warnSpy.mockClear();
  });

  afterEach(() => {
    warnSpy.mockReset();
  });

  afterAll(() => {
    registerSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('registers a patch that merges component configs', () => {
    const registry = createRegistry([
      {
        id: 'filter:text',
        name: 'Text',
        schema: {
          type: 'string',
          'x-component': 'Input',
          'x-component-props': {
            placeholder: 'Base'
          }
        }
      }
    ]);

    const patch = createSchemaPatch(registry);

    expect(patch.isRegistered()).toBe(false);

    patch.register();

    expect(patch.isRegistered()).toBe(true);
    expect(registerSpy).toHaveBeenCalledTimes(1);

    const patchFn = registerSpy.mock.calls[0][0] as (schema: any) => any;
    const schema = {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          'x-component-id': 'filter:text',
          'x-component-props': {
            placeholder: 'Override'
          }
        }
      }
    };

    const patched = patchFn(schema);

    expect(patched.properties.keyword['x-component']).toBe('Input');
    expect(patched.properties.keyword['x-component-props']).toEqual({
      placeholder: 'Override'
    });
    expect(patched.properties.keyword['x-component-id']).toBeUndefined();
  });

  it('warns and strips component id when config is missing', () => {
    const registry = createRegistry([]);
    const patch = createSchemaPatch(registry);
    patch.register();

    const patchFn = registerSpy.mock.calls[0][0] as (schema: any) => any;
    const schema = {
      type: 'object',
      properties: {
        missing: {
          'x-component-id': 'unknown',
          type: 'string'
        }
      }
    };

    const patched = patchFn(schema);

    expect(patched.properties.missing['x-component-id']).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith('[Dynamic Filter] 未找到配置: unknown');
  });

  it('prevents duplicate registration and supports unregister', () => {
    const registry = createRegistry([]);
    const patch = createSchemaPatch(registry);

    patch.register();
    patch.register();

    expect(registerSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[Dynamic Filter] Schema Patch 已经注册，跳过重复注册'
    );

    patch.unregister();

    expect(patch.isRegistered()).toBe(false);

    patch.register();
    expect(registerSpy).toHaveBeenCalledTimes(2);
  });
});
