import { useEffect, useMemo, useState } from 'react';
import { useFieldContext } from '@formily/react';
import { useFilter } from '../context/FilterProvider.js';
import { readFieldSnapshot } from '../core/fieldHelpers.js';
import type { FieldApi, FieldSnapshot, UseFieldOptions } from '../core/types.js';

export function useField(path?: string, options?: UseFieldOptions): FieldApi {
  const filter = useFilter(options);
  const form = filter.form as any;

  const fieldContext = useFieldContext();
  const resolvedPath = path ?? fieldContext?.path?.toString();

  if (!resolvedPath) {
    throw new Error('useField requires a path prop or to be used within a FormItem component');
  }

  const readSnapshot = () => readFieldSnapshot(form, resolvedPath);
  const [snapshot, setSnapshot] = useState<FieldSnapshot>(readSnapshot);

  useEffect(() => {
    setSnapshot(readSnapshot());
    const disposers = [
      form.onFieldValueChange(resolvedPath, () => setSnapshot(readSnapshot())),
      form.onFieldInitialValueChange?.(resolvedPath, () => setSnapshot(readSnapshot())),
      form.onFieldInputValueChange?.(resolvedPath, () => setSnapshot(readSnapshot())),
    ].filter(Boolean);
    return () => {
      disposers.forEach((dispose: () => void) => dispose?.());
    };
  }, [form, resolvedPath]);

  const api = useMemo<FieldApi>(() => {
    return {
      name: resolvedPath,
      get value() {
        return snapshot.value;
      },
      get error() {
        return snapshot.errors[0];
      },
      get validating() {
        return snapshot.validating;
      },
      get visible() {
        return snapshot.displayed;
      },
      get disabled() {
        return snapshot.disabled;
      },
      get touched() {
        return snapshot.touched;
      },
      setValue: (value: any) => {
        form.setFieldValue(resolvedPath, value);
      },
      reset(mode = 'default') {
        filter.resetValue(resolvedPath, mode);
      },
      async validate() {
        await form.validate(resolvedPath);
      },
      getState() {
        return readFieldSnapshot(form, resolvedPath);
      },
      setState(cb) {
        form.setFieldState(resolvedPath, cb);
        setSnapshot(readFieldSnapshot(form, resolvedPath));
      },
    };
  }, [filter, form, resolvedPath, snapshot]);

  return api;
}
