'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Button, Field, FormActions } from '../../../components/form';
import { ApiError } from '../../../lib/api';
import type { ObjectDefinition, ObjectField } from './types';

// Input state per field key: booleans stay booleans (checkbox), everything
// else is the raw input string (numbers are parsed on submit).
export type RecordFormValues = Record<string, string | boolean>;

export function initialRecordValues(
  definition: ObjectDefinition,
  data: Record<string, unknown> = {},
): RecordFormValues {
  const values: RecordFormValues = {};
  for (const field of definition.fields) {
    const value = data[field.key];
    if (field.type === 'boolean') {
      values[field.key] = value === true;
    } else if (typeof value === 'string') {
      values[field.key] = value;
    } else if (typeof value === 'number') {
      values[field.key] = String(value);
    } else {
      values[field.key] = '';
    }
  }
  return values;
}

// Builds the record `data` payload. Empty optional inputs are omitted so the
// API does not receive mistyped values; booleans are always sent.
function buildData(
  fields: ObjectField[],
  values: RecordFormValues,
): { data: Record<string, unknown>; errors: Record<string, string> } {
  const data: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const value = values[field.key];
    if (field.type === 'boolean') {
      data[field.key] = value === true;
      continue;
    }
    const raw = typeof value === 'string' ? value.trim() : '';
    if (raw === '') {
      if (field.required) {
        errors[field.key] = 'This field is required';
      }
      continue;
    }
    if (field.type === 'number') {
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        errors[field.key] = 'Enter a valid number';
        continue;
      }
      data[field.key] = parsed;
      continue;
    }
    data[field.key] = raw;
  }
  return { data, errors };
}

function requiredMark(field: ObjectField): string {
  return field.required ? `${field.label} *` : field.label;
}

export function RecordForm({
  definition,
  initial,
  submitLabel,
  busyLabel,
  onSubmit,
}: {
  definition: ObjectDefinition;
  initial?: RecordFormValues;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<RecordFormValues>(
    () => initial ?? initialRecordValues(definition),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function setValue(key: string, value: string | boolean) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const { data, errors } = buildData(definition.fields, values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setBusy(true);
    try {
      await onSubmit(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Saving the record failed');
      setBusy(false);
    }
  }

  return (
    <form className="nv-form" onSubmit={handleSubmit}>
      {error ? <div className="nv-error">{error}</div> : null}
      {definition.fields.map((field) => {
        const value = values[field.key];
        const inputId = `field-${field.key}`;
        const fieldErrorMessage = fieldErrors[field.key] ?? null;
        if (field.type === 'boolean') {
          return (
            <Field key={field.key} label={requiredMark(field)} htmlFor={inputId}>
              <input
                id={inputId}
                type="checkbox"
                checked={value === true}
                onChange={(e) => setValue(field.key, e.target.checked)}
              />
            </Field>
          );
        }
        const stringValue = typeof value === 'string' ? value : '';
        if (field.type === 'picklist') {
          return (
            <Field
              key={field.key}
              label={requiredMark(field)}
              htmlFor={inputId}
              error={fieldErrorMessage}
            >
              <select
                id={inputId}
                required={field.required}
                value={stringValue}
                onChange={(e) => setValue(field.key, e.target.value)}
              >
                <option value="">Select…</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
          );
        }
        const inputType =
          field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text';
        return (
          <Field
            key={field.key}
            label={requiredMark(field)}
            htmlFor={inputId}
            error={fieldErrorMessage}
          >
            <input
              id={inputId}
              type={inputType}
              required={field.required}
              step={field.type === 'number' ? 'any' : undefined}
              value={stringValue}
              onChange={(e) => setValue(field.key, e.target.value)}
            />
          </Field>
        );
      })}
      <FormActions>
        <Button type="submit" disabled={busy}>
          {busy ? busyLabel : submitLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push(`/admin/objects/${definition.id}/records`)}
        >
          Cancel
        </Button>
      </FormActions>
    </form>
  );
}
