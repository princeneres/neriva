'use client';

import { useParams, useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { Button, Field, FormActions } from '../../../../components/form';
import { useToast } from '../../../../components/toast';
import { ApiError, api } from '../../../../lib/api';
import { type SystemSetting, parseValueInput, splitFieldErrors } from '../shared';

export default function EditSettingPage() {
  const router = useRouter();
  const toast = useToast();
  // The route param is the setting KEY (e.g. smtp.host), not an entity id.
  const params = useParams<{ key: string }>();
  const key = decodeURIComponent(params.key);

  const [valueText, setValueText] = useState('');
  const [valueError, setValueError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: SystemSetting }>(`/system/settings/${encodeURIComponent(key)}`)
      .then(({ data }) => {
        if (!cancelled) {
          setValueText(JSON.stringify(data.value, null, 2));
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load setting');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setValueError(null);
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
        <h1>Edit setting</h1>
      </div>
      <form className="nv-form" onSubmit={onSubmit}>
        {error ? <div className="nv-error">{error}</div> : null}
        <Field label="Key" htmlFor="key">
          <input id="key" type="text" readOnly value={key} />
        </Field>
        <Field label="Value (JSON)" htmlFor="value" error={valueError}>
          <textarea
            id="value"
            rows={10}
            required
            disabled={loading}
            value={loading ? 'Loading…' : valueText}
            onChange={(e) => setValueText(e.target.value)}
          />
          <small>
            Any JSON value. Plain text that is not valid JSON is saved as a JSON string.
          </small>
        </Field>
        <FormActions>
          <Button type="submit" disabled={busy || loading}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push('/admin/settings')}>
            Cancel
          </Button>
        </FormActions>
      </form>
    </>
  );
}
