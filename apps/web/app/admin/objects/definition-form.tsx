'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useState } from 'react';
import { Button, Field, FormActions } from '../../../components/form';
import { ApiError } from '../../../lib/api';
import { FIELD_KEY_PATTERN, FIELD_TYPES, type ObjectField, type ObjectFieldType } from './types';

export interface DefinitionFormValues {
  name: string;
  pluralName: string;
  description: string;
  fields: ObjectField[];
}

interface FieldRow {
  rowKey: number;
  key: string;
  label: string;
  type: ObjectFieldType;
  required: boolean;
  options: string;
}

interface RowErrors {
  key?: string;
  options?: string;
}

const KEY_HINT = 'Use a lowercase letter followed by letters or digits (e.g. firstName)';

function fieldError(errors: string[], field: string): string | null {
  return errors.find((message) => message.toLowerCase().startsWith(field.toLowerCase())) ?? null;
}

function parseOptions(raw: string): string[] {
  return raw
    .split(',')
    .map((option) => option.trim())
    .filter((option) => option !== '');
}

function toRows(fields: ObjectField[]): FieldRow[] {
  return fields.map((field, index) => ({
    rowKey: index + 1,
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    options: (field.options ?? []).join(', '),
  }));
}

export function DefinitionForm({
  initial,
  submitLabel,
  busyLabel,
  onSubmit,
  children,
}: {
  initial?: DefinitionFormValues;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (values: DefinitionFormValues) => Promise<void>;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? '');
  const [pluralName, setPluralName] = useState(initial?.pluralName ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [rows, setRows] = useState<FieldRow[]>(() => toRows(initial?.fields ?? []));
  const [nextKey, setNextKey] = useState(() => (initial?.fields.length ?? 0) + 1);
  const [rowErrors, setRowErrors] = useState<Record<number, RowErrors>>({});
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function addRow() {
    setRows((current) => [
      ...current,
      { rowKey: nextKey, key: '', label: '', type: 'text', required: false, options: '' },
    ]);
    setNextKey((key) => key + 1);
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
      if (!FIELD_KEY_PATTERN.test(row.key)) {
        rowError.key = KEY_HINT;
      } else if (seenKeys.has(row.key)) {
        rowError.key = `Duplicate key "${row.key}"`;
      }
      seenKeys.add(row.key);
      if (row.type === 'picklist' && parseOptions(row.options).length === 0) {
        rowError.options = 'Picklist needs at least one option';
      }
      if (rowError.key || rowError.options) {
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
        pluralName,
        description,
        fields: rows.map((row) => ({
          key: row.key,
          label: row.label,
          type: row.type,
          required: row.required,
          ...(row.type === 'picklist' ? { options: parseOptions(row.options) } : {}),
        })),
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.problem.errors ?? []);
      } else {
        setError('Saving the object definition failed');
      }
      setBusy(false);
    }
  }

  return (
    <form className="nv-form" onSubmit={handleSubmit}>
      {error ? <div className="nv-error">{error}</div> : null}
      {children}
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
      <Field label="Plural name" htmlFor="pluralName" error={fieldError(fieldErrors, 'pluralName')}>
        <input
          id="pluralName"
          type="text"
          required
          maxLength={255}
          value={pluralName}
          onChange={(e) => setPluralName(e.target.value)}
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
              style={{
                display: 'flex',
                gap: 'var(--nv-space-2)',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
              }}
            >
              <div className="nv-field" style={{ flex: 1, minWidth: '10rem' }}>
                <input
                  type="text"
                  aria-label="Field key"
                  placeholder="Key (e.g. firstName)"
                  required
                  value={row.key}
                  onChange={(e) => updateRow(row.rowKey, { key: e.target.value })}
                />
                {rowErrors[row.rowKey]?.key ? (
                  <span className="nv-field-error">{rowErrors[row.rowKey]?.key}</span>
                ) : null}
              </div>
              <div className="nv-field" style={{ flex: 1, minWidth: '10rem' }}>
                <input
                  type="text"
                  aria-label="Field label"
                  placeholder="Label"
                  required
                  value={row.label}
                  onChange={(e) => updateRow(row.rowKey, { label: e.target.value })}
                />
              </div>
              <div className="nv-field">
                <select
                  aria-label="Field type"
                  value={row.type}
                  onChange={(e) =>
                    updateRow(row.rowKey, { type: e.target.value as ObjectFieldType })
                  }
                >
                  {FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <label
                style={{
                  display: 'flex',
                  gap: 'var(--nv-space-1)',
                  alignItems: 'center',
                  paddingTop: '0.5rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={row.required}
                  onChange={(e) => updateRow(row.rowKey, { required: e.target.checked })}
                />
                Required
              </label>
              {row.type === 'picklist' ? (
                <div className="nv-field" style={{ flex: 1, minWidth: '10rem' }}>
                  <input
                    type="text"
                    aria-label="Picklist options"
                    placeholder="Options, comma separated"
                    value={row.options}
                    onChange={(e) => updateRow(row.rowKey, { options: e.target.value })}
                  />
                  {rowErrors[row.rowKey]?.options ? (
                    <span className="nv-field-error">{rowErrors[row.rowKey]?.options}</span>
                  ) : null}
                </div>
              ) : null}
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
        <Button type="button" variant="secondary" onClick={() => router.push('/admin/objects')}>
          Cancel
        </Button>
      </FormActions>
    </form>
  );
}
