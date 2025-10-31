import { describe, it, expect } from 'vitest';
import { DynamicFilterContext } from '../src/provider/context';

describe('DynamicFilterContext', () => {
  it('has an explicit display name for debugging', () => {
    expect(DynamicFilterContext.displayName).toBe('DynamicFilterContext');
  });
});
