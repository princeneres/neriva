'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Button, Field, FormActions } from '../../../../components/form';
import { useToast } from '../../../../components/toast';
import { ApiError, api } from '../../../../lib/api';
import {
  KEY_HINT,
  KEY_PATTERN,
  WellKnownKeysCard,
  parseValueInput,
  splitFieldErrors,
} from '../shared';

export default function NewSettingPage() {
  const router = useRouter();
  const toast = useToast();
  const [key, setKey] = useState('');
  const [valueText, setValueText] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [valueError, setValueError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setKeyError(null);
    setValueError(null);
    if (!KEY_PATTERN.test(key)) {
      setKeyError(KEY_HINT);
      return;
    }
    if (valueText.trim() === '') {
      setValueError('Value is required');
      return;
    }
    setBusy(true);
    try {
      const value = parseValueInput(valueText);
      await api.put(`/system/settings/${encodeURIComponent(key)}`, { value });
      toast.success('Setting saved');
      router.push('/admin/settings');
    } catch (err) {
      if (err instanceof ApiError) {
        const fields = splitFieldErrors(err.problem.errors);
        setKeyError(fields.key);
        setValueError(fields.value);
        setError(fields.other.length > 0 ? fields.other.join('. ') : err.message);
      } else {
        setError('Request failed');
      }
      setBusy(false);
    }
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1>New setting</h1>
      </div>
      <form className="nv-form" onSubmit={onSubmit}>
        {error ? <div className="nv-error">{error}</div> : null}
        <Field label="Key" htmlFor="key" error={keyError}>
          <input
            id="key"
            type="text"
            required
            placeholder="site.name"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <small>{KEY_HINT}</small>
        </Field>
        <Field label="Value (JSON)" htmlFor="value" error={valueError}>
          <textarea
            id="value"
            rows={8}
            required
            placeholder='"My site" or { "host": "smtp.example.com" }'
            value={valueText}
            onChange={(e) => setValueText(e.target.value)}
          />
          <small>
            Any JSON value. Plain text that is not valid JSON is saved as a JSON string.
          </small>
        </Field>
        <FormActions>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push('/admin/settings')}>
            Cancel
          </Button>
        </FormActions>
      </form>
      <WellKnownKeysCard />
    </>
  );
}
