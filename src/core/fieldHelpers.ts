import type { Form } from '@formily/core';
import type { FieldApi, FieldSnapshot } from './types';

export function readFieldSnapshot(form: Form, path: string): FieldSnapshot {
  let snapshot: FieldSnapshot = {
    value: undefined,
    initialValue: undefined,
    displayed: true,
    disabled: false,
    validating: false,
    errors: [],
    touched: false,
  };

  form.setFieldState(path, (field: any) => {
    snapshot = {
      value: field.value,
      initialValue: field.initialValue,
      displayed: field.display !== 'none' && field.visible !== false,
      disabled: Boolean(field.disabled || field.pattern === 'readPretty'),
      validating: Boolean(field.validating || field.loading),
      errors: normalizeErrors(field.selfErrors ?? field.errors ?? []),
      touched: Boolean(field.visited || field.touched || field.mounted),
    };
  });

  return snapshot;
}

function normalizeErrors(errors: unknown[]): string[] {
  return errors
    .map((err) => {
      if (!err) return '';
      if (typeof err === 'string') return err;
      if (Array.isArray(err)) return err.join(', ');
      if (err && typeof err === 'object' && 'message' in err) return String((err as Record<string, unknown>).message);
      return String(err);
    })
    .filter(Boolean);
}

export function createFieldApi(form: Form, path: string): FieldApi {
  return {
    name: path,
    get value() {
      return readFieldSnapshot(form, path).value;
    },
    get error() {
      return readFieldSnapshot(form, path).errors[0];
    },
    get validating() {
      return readFieldSnapshot(form, path).validating;
    },
    get visible() {
      return readFieldSnapshot(form, path).displayed;
    },
    get disabled() {
      return readFieldSnapshot(form, path).disabled;
    },
    get touched() {
      return readFieldSnapshot(form, path).touched;
    },
    setValue(value: unknown) {
      (form as any).setFieldValue(path, value);
    },
    reset(mode = 'initial') {
      const field = form.query(path).take() as any;
      if (!field) return;

      if (mode === 'initial') {
        field.reset();
      } else if (mode === 'default') {
        field.value = field.initialValue;
      } else if (mode === 'applied') {
        field.value = field.initialValue;
      }
    },
    async validate() {
      await form.validate(path);
    },
    getState() {
      return readFieldSnapshot(form, path);
    },
    setState(cb) {
      form.setFieldState(path, cb);
    },
  };
}
