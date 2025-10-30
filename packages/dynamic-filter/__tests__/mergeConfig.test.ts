import { describe, it, expect } from 'vitest';
import { mergeConfig } from '../src/utils/merge';

describe('mergeConfig', () => {
  it('deep merges objects and replaces arrays', () => {
    const base = {
      id: 'filter:text',
      schema: {
        type: 'string',
        enum: ['a', 'b']
      }
    };
    const override = {
      schema: {
        enum: ['c'],
        'x-component-props': {
          placeholder: 'Search'
        }
      }
    };

    const merged = mergeConfig(base, override);

    expect(merged).not.toBe(base);
    expect(merged.schema.enum).toEqual(['c']);
    expect(merged.schema['x-component-props']).toEqual({ placeholder: 'Search' });
    expect(base.schema.enum).toEqual(['a', 'b']);
  });

  it('returns a cloned copy when no overrides are supplied', () => {
    const base = { a: { b: 1 } };

    const merged = mergeConfig(base);

    expect(merged).toEqual(base);
    expect(merged).not.toBe(base);
    expect(merged.a).not.toBe(base.a);
  });
});
