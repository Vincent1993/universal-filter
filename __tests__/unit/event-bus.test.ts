import { describe, it, expect, vi } from 'vitest';
import { createFilter } from '../../src/core/createFilter';

describe('Event Bus', () => {
  it('should emit draft:change when values change', async () => {
    const filter = createFilter<{ name?: string }>({ defaultValues: {} });

    const onDraftChange = vi.fn();
    const off = filter.events.on('draft:change', ({ draft }) => onDraftChange(draft));

    filter.form.setValues({ name: 'Alice' });

    expect(onDraftChange).toHaveBeenCalledTimes(1);
    expect(onDraftChange).toHaveBeenCalledWith({ name: 'Alice' });

    off();
  });

  it('should support once subscription', async () => {
    const filter = createFilter<{ count?: number }>({ defaultValues: {} });

    const onOnce = vi.fn();
    filter.events.once('draft:change', ({ draft }) => onOnce(draft));

    filter.form.setValues({ count: 1 });
    filter.form.setValues({ count: 2 });

    expect(onOnce).toHaveBeenCalledTimes(1);
    expect(onOnce).toHaveBeenCalledWith({ count: 1 });
  });

  it('should emit apply:start and apply:success on apply()', async () => {
    const filter = createFilter<{ n?: number }>({ defaultValues: {} });

    const starts: Array<{ n?: number }> = [];
    const successes: Array<{ n?: number }> = [];

    const offStart = filter.events.on('apply:start', ({ draft }) => starts.push(draft));
    const offSuccess = filter.events.on('apply:success', ({ draft }) => successes.push(draft));

    filter.form.setValues({ n: 3 });
    await filter.apply();

    expect(starts.length).toBe(1);
    expect(successes.length).toBe(1);
    expect(starts[0]).toEqual({ n: 3 });
    expect(successes[0]).toEqual({ n: 3 });

    offStart();
    offSuccess();
  });

  it('should emit reset event on reset()', () => {
    const filter = createFilter<{ a?: string }>({ defaultValues: { a: 'x' } });
    const onReset = vi.fn();

    const off = filter.events.on('reset', () => onReset());
    filter.reset();

    expect(onReset).toHaveBeenCalledTimes(1);
    off();
  });
});



