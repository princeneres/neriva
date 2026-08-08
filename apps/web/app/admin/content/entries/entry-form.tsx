'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Button, Field, FormActions } from '../../../../components/form';
import { ApiError } from '../../../../lib/api';
import type { ContentField, ContentType } from '../types';

export interface EntryFormValues {
  title: string;
  values: Record<string, unknown>;
}

// UI state per field: strings for inputs, boolean for checkboxes.
type FieldState = Record<string, string | boolean>;

function toFieldState(fields: ContentField[], values: Record<string, unknown>): FieldState {
  const state: FieldState = {};
  for (const field of fields) {
    const value = values[field.key];
    switch (field.type) {
      case 'boolean':
        state[field.key] = value === true;
        break;
      case 'number':
        state[field.key] = typeof value === 'number' ? String(value) : '';
        break;
      case 'date':
        // ISO 8601 string; keep only the date part for <input type="date">.
        state[field.key] = typeof value === 'string' ? value.slice(0, 10) : '';
        break;
      default:
        state[field.key] = typeof value === 'string' ? value : '';
    }
  }
  return state;
}

function toValues(fields: ContentField[], state: FieldState): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = state[field.key];
    switch (field.type) {
      case 'boolean':
        values[field.key] = raw === true;
        break;
      case 'number': {
        const text = typeof raw === 'string' ? raw.trim() : '';
        if (text !== '') {
          values[field.key] = Number(text);
        }
        break;
      }
      case 'date': {
        const text = typeof raw === 'string' ? raw : '';
        if (text !== '') {
          values[field.key] = new Date(text).toISOString();
        }
        break;
      }
      default: {
        const text = typeof raw === 'string' ? raw : '';
        if (text !== '') {
          values[field.key] = text;
        }
      }
    }
  }
  return values;
}

function fieldLabel(field: ContentField): string {
  return field.required ? `${field.label} *` : field.label;
}

export function EntryForm({
  contentType,
  initial,
  submitLabel,
  busyLabel,
  onSubmit,
}: {
  contentType: ContentType;
  initial?: EntryFormValues;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (values: EntryFormValues) => Promise<void>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [fieldState, setFieldState] = useState<FieldState>(() =>
    toFieldState(contentType.fields, initial?.values ?? {}),
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function setValue(key: string, value: string | boolean) {
    setFieldState((current) => ({ ...current, [key]: value }));
  }

  function apiFieldError(field: string): string | null {
    return (
      fieldErrors.find((message) => message.toLowerCase().includes(field.toLowerCase())) ?? null
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors([]);
    setBusy(true);
    try {
      await onSubmit({ title, values: toValues(contentType.fields, fieldState) });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.problem.errors ?? []);
      } else {
        setError('Saving the entry failed');
      }
      setBusy(false);
    }
  }

  function renderInput(field: ContentField) {
    const raw = fieldState[field.key];
    const text = typeof raw === 'string' ? raw : '';
    switch (field.type) {
      case 'richtext':
        return (
          <textarea
            id={`field-${field.key}`}
            rows={6}
            required={field.required}
            value={text}
            onChange={(e) => setValue(field.key, e.target.value)}
          />
        );
      case 'number':
        return (
          <input
            id={`field-${field.key}`}
            type="number"
            step="any"
            required={field.required}
            value={text}
            onChange={(e) => setValue(field.key, e.target.value)}
          />
        );
      case 'boolean':
        return (
          <input
            id={`field-${field.key}`}
            type="checkbox"
            checked={raw === true}
            onChange={(e) => setValue(field.key, e.target.checked)}
          />
        );
      case 'date':
        return (
          <input
            id={`field-${field.key}`}
            type="date"
            required={field.required}
            value={text}
            onChange={(e) => setValue(field.key, e.target.value)}
          />
        );
      default:
        return (
          <input
            id={`field-${field.key}`}
            type="text"
            required={field.required}
            value={text}
            onChange={(e) => setValue(field.key, e.target.value)}
          />
        );
    }
  }

  return (
    <form className="nv-form" onSubmit={handleSubmit}>
      {error ? <div className="nv-error">{error}</div> : null}
      <Field label="Title" htmlFor="title" error={apiFieldError('title')}>
        <input
          id="title"
          type="text"
          required
          maxLength={255}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      {contentType.fields.map((field) => (
        <Field
          key={field.key}
          label={fieldLabel(field)}
          htmlFor={`field-${field.key}`}
          error={apiFieldError(field.key)}
        >
          {renderInput(field)}
        </Field>
      ))}
      <FormActions>
        <Button type="submit" disabled={busy}>
          {busy ? busyLabel : submitLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push('/admin/content/entries')}
        >
          Cancel
        </Button>
      </FormActions>
    </form>
  );
}
