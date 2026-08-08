'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Button, Field, FormActions } from '../../../components/form';
import { ApiError } from '../../../lib/api';
import type { ContentField } from './types';

export interface ContentTypeFormValues {
  name: string;
  description: string;
  fields: ContentField[];
}

const FIELD_TYPES: ContentField['type'][] = ['text', 'richtext', 'number', 'boolean', 'date'];
const KEY_PATTERN = /^[a-z][a-zA-Z0-9]*$/;
const KEY_HINT = 'Start with a lowercase letter, then letters and digits only (e.g. headline)';

interface FieldRow {
  rowKey: number;
  key: string;
  label: string;
  type: ContentField['type'];
  required: boolean;
}

interface RowErrors {
  key?: string;
  label?: string;
}

function fieldError(errors: string[], field: string): string | null {
  return errors.find((message) => message.toLowerCase().startsWith(field.toLowerCase())) ?? null;
}

export function ContentTypeForm({
  initial,
  submitLabel,
  busyLabel,
  onSubmit,
}: {
  initial?: ContentTypeFormValues;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (values: ContentTypeFormValues) => Promise<void>;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [nextRowKey, setNextRowKey] = useState(() => (initial?.fields.length ?? 0) + 1);
  const [rows, setRows] = useState<FieldRow[]>(
    () =>
      initial?.fields.map((field, index) => ({
        rowKey: index + 1,
        key: field.key,
        label: field.label,
        type: field.type,
        required: field.required,
      })) ?? [],
  );
  const [rowErrors, setRowErrors] = useState<Record<number, RowErrors>>({});
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function addRow() {
    setRows((current) => [
      ...current,
      { rowKey: nextRowKey, key: '', label: '', type: 'text', required: false },
    ]);
    setNextRowKey((key) => key + 1);
  }

  function removeRow(rowKey: number) {
    setRows((current) => current.filter((row) => row.rowKey !== rowKey));
    setRowErrors((current) => {
      const { [rowKey]: _removed, ...rest } = current;
      return rest;
    });
  }

  function updateRow(rowKey: number, patch: Partial<Omit<FieldRow, 'rowKey'>>) {
    setRows((current) =>
      current.map((row) => (row.rowKey === rowKey ? { ...row, ...patch } : row)),
    );
  }

  function validateRows(): boolean {
    const errors: Record<number, RowErrors> = {};
    const seenKeys = new Set<string>();
    for (const row of rows) {
      const rowError: RowErrors = {};
      if (!KEY_PATTERN.test(row.key)) {
        rowError.key = KEY_HINT;
      } else if (seenKeys.has(row.key)) {
        rowError.key = `Duplicate key "${row.key}"`;
      } else {
        seenKeys.add(row.key);
      }
      if (row.label.trim() === '') {
        rowError.label = 'Label is required';
      }
      if (rowError.key || rowError.label) {
        errors[row.rowKey] = rowError;
      }
    }
    setRowErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors([]);
    if (!validateRows()) {
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        name,
        description,
        fields: rows.map((row) => ({
          key: row.key,
          label: row.label,
          type: row.type,
          required: row.required,
        })),
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.problem.errors ?? []);
      } else {
        setError('Saving the content type failed');
      }
      setBusy(false);
    }
  }

  return (
    <form className="nv-form" onSubmit={handleSubmit}>
      {error ? <div className="nv-error">{error}</div> : null}
      <Field label="Name" htmlFor="name" error={fieldError(fieldErrors, 'name')}>
        <input
          id="name"
          type="text"
          required
          maxLength={255}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field
        label="Description"
        htmlFor="description"
        error={fieldError(fieldErrors, 'description')}
      >
        <textarea
          id="description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <Field label="Fields" error={fieldError(fieldErrors, 'fields')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--nv-space-2)' }}>
          {rows.map((row) => (
            <div
              key={row.rowKey}
              style={{ display: 'flex', gap: 'var(--nv-space-2)', alignItems: 'flex-start' }}
            >
              <div className="nv-field" style={{ flex: 1 }}>
                <input
                  type="text"
                  aria-label="Field key"
                  placeholder="Key (e.g. headline)"
                  value={row.key}
                  onChange={(e) => updateRow(row.rowKey, { key: e.target.value })}
                />
                {rowErrors[row.rowKey]?.key ? (
                  <span className="nv-field-error">{rowErrors[row.rowKey]?.key}</span>
                ) : null}
              </div>
              <div className="nv-field" style={{ flex: 1 }}>
                <input
                  type="text"
                  aria-label="Field label"
                  placeholder="Label (e.g. Headline)"
                  value={row.label}
                  onChange={(e) => updateRow(row.rowKey, { label: e.target.value })}
                />
                {rowErrors[row.rowKey]?.label ? (
                  <span className="nv-field-error">{rowErrors[row.rowKey]?.label}</span>
                ) : null}
              </div>
              <select
                aria-label="Field type"
                value={row.type}
                onChange={(e) =>
                  updateRow(row.rowKey, { type: e.target.value as ContentField['type'] })
                }
              >
                {FIELD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <label
                style={{
                  display: 'flex',
                  gap: 'var(--nv-space-1)',
                  alignItems: 'center',
                  whiteSpace: 'nowrap',
                  paddingTop: '6px',
                }}
              >
                <input
                  type="checkbox"
                  checked={row.required}
                  onChange={(e) => updateRow(row.rowKey, { required: e.target.checked })}
                />
                Required
              </label>
              <Button type="button" variant="danger" onClick={() => removeRow(row.rowKey)}>
                Remove
              </Button>
            </div>
          ))}
          <div>
            <Button type="button" variant="secondary" onClick={addRow}>
              Add field
            </Button>
          </div>
        </div>
      </Field>
      <FormActions>
        <Button type="submit" disabled={busy}>
          {busy ? busyLabel : submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push('/admin/content')}>
          Cancel
        </Button>
      </FormActions>
    </form>
  );
}
