'use client';

import type { components } from '@neriva/contracts';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Button, Field, FormActions } from '../../../components/form';
import { ApiError } from '../../../lib/api';

type Permission = components['schemas']['PermissionDto'];

export interface RoleFormValues {
  name: string;
  description: string;
  permissions: Permission[];
}

// Allowed values per the API: '*' or a lowercase identifier such as 'page' or 'content-entry'.
const PERMISSION_PART_PATTERN = /^(\*|[a-z][a-z-]*)$/;
const PERMISSION_PART_HINT = 'Use * or lowercase letters and dashes (e.g. page, content-entry)';

interface PermissionRow {
  key: number;
  resourceType: string;
  action: string;
}

interface RowErrors {
  resourceType?: string;
  action?: string;
}

function fieldError(errors: string[] | undefined, field: string): string | null {
  return errors?.find((message) => message.toLowerCase().startsWith(field.toLowerCase())) ?? null;
}

export function RoleForm({
  initial,
  submitLabel,
  busyLabel,
  onSubmit,
}: {
  initial?: RoleFormValues;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (values: RoleFormValues) => Promise<void>;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [nextKey, setNextKey] = useState(() => (initial?.permissions.length ?? 0) + 1);
  const [rows, setRows] = useState<PermissionRow[]>(
    () =>
      initial?.permissions.map((permission, index) => ({
        key: index + 1,
        resourceType: permission.resourceType,
        action: permission.action,
      })) ?? [],
  );
  const [rowErrors, setRowErrors] = useState<Record<number, RowErrors>>({});
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function addRow() {
    setRows((current) => [...current, { key: nextKey, resourceType: '', action: '' }]);
    setNextKey((key) => key + 1);
  }

  function removeRow(key: number) {
    setRows((current) => current.filter((row) => row.key !== key));
    setRowErrors((current) => {
      const { [key]: _removed, ...rest } = current;
      return rest;
    });
  }

  function updateRow(key: number, patch: Partial<Pick<PermissionRow, 'resourceType' | 'action'>>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function validateRows(): boolean {
    const errors: Record<number, RowErrors> = {};
    for (const row of rows) {
      const rowError: RowErrors = {};
      if (!PERMISSION_PART_PATTERN.test(row.resourceType)) {
        rowError.resourceType = PERMISSION_PART_HINT;
      }
      if (!PERMISSION_PART_PATTERN.test(row.action)) {
        rowError.action = PERMISSION_PART_HINT;
      }
      if (rowError.resourceType || rowError.action) {
        errors[row.key] = rowError;
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
        permissions: rows.map((row) => ({ resourceType: row.resourceType, action: row.action })),
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.problem.errors ?? []);
      } else {
        setError('Saving the role failed');
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
      <Field label="Permissions" error={fieldError(fieldErrors, 'permissions')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--nv-space-2)' }}>
          {rows.map((row) => (
            <div
              key={row.key}
              style={{ display: 'flex', gap: 'var(--nv-space-2)', alignItems: 'flex-start' }}
            >
              <div className="nv-field" style={{ flex: 1 }}>
                <input
                  type="text"
                  aria-label="Resource type"
                  placeholder="Resource type (* or page)"
                  value={row.resourceType}
                  onChange={(e) => updateRow(row.key, { resourceType: e.target.value })}
                />
                {rowErrors[row.key]?.resourceType ? (
                  <span className="nv-field-error">{rowErrors[row.key]?.resourceType}</span>
                ) : null}
              </div>
              <div className="nv-field" style={{ flex: 1 }}>
                <input
                  type="text"
                  aria-label="Action"
                  placeholder="Action (* or create)"
                  value={row.action}
                  onChange={(e) => updateRow(row.key, { action: e.target.value })}
                />
                {rowErrors[row.key]?.action ? (
                  <span className="nv-field-error">{rowErrors[row.key]?.action}</span>
                ) : null}
              </div>
              <Button type="button" variant="danger" onClick={() => removeRow(row.key)}>
                Remove
              </Button>
            </div>
          ))}
          <div>
            <Button type="button" variant="secondary" onClick={addRow}>
              Add permission
            </Button>
          </div>
        </div>
      </Field>
      <FormActions>
        <Button type="submit" disabled={busy}>
          {busy ? busyLabel : submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push('/admin/roles')}>
          Cancel
        </Button>
      </FormActions>
    </form>
  );
}
