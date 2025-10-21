import { useMemo } from 'react';
import { useField as formilyUseField } from '@formily/react';
import type { Field } from '@formily/core';
import { useFilter } from './useFilter';
import type { FieldApi, FieldSnapshot, UseFieldOptions } from '../core/types';

export function useField(path?: string, options?: UseFieldOptions): FieldApi {
  const filter = useFilter(options);
  const form = filter.form;

  const formilyField = formilyUseField();
  let resolvedPath = path;
  if (!resolvedPath && formilyField) {
    const addressStr = (formilyField as any).address?.entire;
    if (!addressStr && typeof (formilyField as any).path === 'object' && (formilyField as any).path?.toString) {
      resolvedPath = (formilyField as any).path.toString();
    } else if (addressStr && typeof addressStr === 'string') {
      resolvedPath = addressStr;
    }
  }

  if (!resolvedPath) {
    throw new Error('useField requires a path prop or to be used within a Formily Field component');
  }

  const getFieldInstance = (): Field | undefined => {
    const field = form.query(resolvedPath).take() as Field | undefined;
    return field && 'value' in field ? field : undefined;
  };

  const normalizeErrors = (errors: unknown[]): string[] => {
    return (errors || [])
      .map((err) => {
        if (!err) return '';
        if (typeof err === 'string') return err;
        if (Array.isArray(err)) return err.map((e) => String(e)).join(', ');
        if (typeof err === 'object' && 'message' in err) return String((err as Record<string, unknown>).message);
        return String(err);
      })
      .filter(Boolean);
  };

  const api = useMemo<FieldApi>(
    () => ({
      name: resolvedPath,
      get value() {
        return getFieldInstance()?.value;
      },
      get error() {
        const field = getFieldInstance();
        const errors = normalizeErrors((field?.errors as unknown[]) ?? []);
        return errors[0];
      },
      get validating() {
        return getFieldInstance()?.validating ?? false;
      },
      get visible() {
        const field = getFieldInstance();
        return field?.display !== 'hidden' && field?.display !== 'none';
      },
      get disabled() {
        const field = getFieldInstance();
        return field?.disabled ?? false;
      },
      get touched() {
        const field = getFieldInstance();
        return (field as any)?.touched ?? false;
      },
      setValue(value, opts) {
        const field = getFieldInstance();
        if (field) {
          field.value = value;
          if (!opts?.silent) {
            form.notify('fieldValueChanged', { path: resolvedPath, value });
          }
        }
      },
      reset(mode = 'initial') {
        const field = getFieldInstance();
        if (!field) return;

        if (mode === 'initial') {
          field.reset();
        } else if (mode === 'default') {
          field.value = field.initialValue;
        } else if (mode === 'applied') {
          const appliedField = form.query(resolvedPath).take() as Field | undefined;
          if (appliedField && 'value' in appliedField) {
            field.value = appliedField.value;
          }
        }
      },
      async validate() {
        const field = getFieldInstance();
        if (field) {
          await field.validate();
        }
      },
      getState(): FieldSnapshot {
        const field = getFieldInstance();
        return {
          value: field?.value,
          initialValue: field?.initialValue,
          displayed: field?.display !== 'hidden' && field?.display !== 'none',
          disabled: field?.disabled ?? false,
          validating: field?.validating ?? false,
          errors: normalizeErrors((field?.errors as unknown[]) ?? []),
          touched: (field as any)?.touched ?? false,
        };
      },
      setState(cb) {
        const field = form.query(resolvedPath).take();
        if (field) {
          cb(field as any);
        }
      },
    }),
    [resolvedPath, form]
  );

  return api;
}
