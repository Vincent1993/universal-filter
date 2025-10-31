import { describe, it, expect } from 'vitest';
import * as dynamicFilter from '../src';

describe('package exports', () => {
  it('exposes the public API surface', () => {
    expect(typeof dynamicFilter.DynamicFilterProvider).toBe('function');
    expect(typeof dynamicFilter.useDynamicFields).toBe('function');
    expect(typeof dynamicFilter.useFilterRegistry).toBe('function');
    expect(typeof dynamicFilter.useSchemaField).toBe('function');
    expect(typeof dynamicFilter.mergeConfig).toBe('function');
    expect(typeof dynamicFilter.createSchemaPatch).toBe('function');
  });
});
