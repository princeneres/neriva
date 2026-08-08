'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { Button, Field, FormActions } from '../../../components/form';
import { ApiError } from '../../../lib/api';
import {
  TOKEN_NAME_PATTERN,
  rowsToTokens,
  tokensToRows,
  validateTokenRows,
  type TokenRow,
} from './token-rows';

export interface StyleBookDraft {
  name: string;
  tokens: Record<string, string>;
}

export function StyleBookForm({
  initialName = '',
  initialTokens = {},
  submitLabel,
  onSubmit,
  onRowsChange,
}: {
  initialName?: string;
  initialTokens?: Record<string, string>;
  submitLabel: string;
  onSubmit: (draft: StyleBookDraft) => Promise<void>;
  onRowsChange?: (rows: TokenRow[]) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [rows, setRows] = useState<TokenRow[]>(() => tokensToRows(initialTokens));
  const nextId = useRef(rows.length + 1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [tokensError, setTokensError] = useState<string | null>(null);

  function updateRows(next: TokenRow[]) {
    setRows(next);
    onRowsChange?.(next);
  }

  function addRow() {
    const id = nextId.current;
    nextId.current += 1;
    updateRows([...rows, { id, name: '', value: '' }]);
  }

  function removeRow(id: number) {
    updateRows(rows.filter((row) => row.id !== id));
  }

  function changeRow(id: number, patch: Partial<Pick<TokenRow, 'name' | 'value'>>) {
    updateRows(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNameError(null);
    setTokensError(null);

    const trimmedName = name.trim();
    if (trimmedName === '') {
      setNameError('Name is required.');
      return;
    }
    const validationErrors = validateTokenRows(rows);
    if (validationErrors.length > 0) {
      setTokensError(validationErrors.join(' '));
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({ name: trimmedName, tokens: rowsToTokens(rows) });
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldErrors = err.problem.errors ?? [];
        const nameMessages = fieldErrors.filter((m) => m.toLowerCase().startsWith('name'));
        const tokenMessages = fieldErrors.filter((m) => m.toLowerCase().includes('token'));
        if (nameMessages.length > 0) {
          setNameError(nameMessages.join(' '));
        }
        if (tokenMessages.length > 0) {
          setTokensError(tokenMessages.join(' '));
        }
        setError(err.message);
      } else {
        setError('Unexpected error. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="nv-form" onSubmit={handleSubmit}>
      {error ? <div className="nv-error">{error}</div> : null}
      <Field label="Name" htmlFor="style-book-name" error={nameError}>
        <input
          id="style-book-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Default theme"
          disabled={submitting}
        />
      </Field>
      <Field label="Tokens" error={tokensError}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--nv-space-2)' }}>
          {rows.map((row) => {
            const trimmed = row.name.trim();
            const invalidName = trimmed !== '' && !TOKEN_NAME_PATTERN.test(trimmed);
            return (
              <div key={row.id}>
                <div style={{ display: 'flex', gap: 'var(--nv-space-2)' }}>
                  <input
                    aria-label="Token name"
                    placeholder="color-primary"
                    value={row.name}
                    onChange={(event) => changeRow(row.id, { name: event.target.value })}
                    disabled={submitting}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <input
                    aria-label="Token value"
                    placeholder="#cc3d47"
                    value={row.value}
                    onChange={(event) => changeRow(row.id, { value: event.target.value })}
                    disabled={submitting}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => removeRow(row.id)}
                    disabled={submitting}
                  >
                    Remove
                  </Button>
                </div>
                {invalidName ? (
                  <span className="nv-field-error">
                    Use lowercase letters, digits and dashes, starting with a letter.
                  </span>
                ) : null}
              </div>
            );
          })}
          {rows.length === 0 ? (
            <span style={{ color: 'var(--nv-color-neutral-500)', fontSize: 'var(--nv-text-sm)' }}>
              No tokens yet.
            </span>
          ) : null}
          <div>
            <Button type="button" variant="secondary" onClick={addRow} disabled={submitting}>
              Add token
            </Button>
          </div>
        </div>
      </Field>
      <FormActions>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push('/admin/style-book')}
          disabled={submitting}
        >
          Cancel
        </Button>
      </FormActions>
    </form>
  );
}
