'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Field } from '../../../../components/form';
import { useToast } from '../../../../components/toast';
import { ApiError, api } from '../../../../lib/api';
import { PageForm, type PageFormValues } from '../page-form';
import { stringifyTree } from '../tree-utils';
import type { Page } from '../types';

export default function EditPagePage() {
  const toast = useToast();
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState<Page | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    api
      .get<{ data: Page }>(`/pages/${id}`)
      .then(({ data }) => setPage(data))
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load page');
      });
  }, [id]);

  async function onSubmit(values: PageFormValues) {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.patch<{ data: Page }>(`/pages/${id}`, values);
      setPage(data);
      toast.success('Page saved');
    } catch (err) {
      // Tree validation 400s carry a node pointer in the problem detail;
      // they render in the inline error box of the form.
      setError(
        err instanceof ApiError ? err : new ApiError({ status: 0, detail: 'Request failed' }),
      );
    } finally {
      setBusy(false);
    }
  }

  async function onPublish() {
    if (!page || !window.confirm(`Publish page "${page.title}"?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post<{ data: Page }>(`/pages/${id}/publish`);
      setPage(data);
      toast.success('Page published');
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError({ status: 0, detail: 'Request failed' }),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1>{page ? page.title : 'Edit page'}</h1>
        {page ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--nv-space-3)' }}>
            <span className="nv-badge" data-status={page.status}>
              {page.status}
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void onPublish()}
            >
              Publish
            </Button>
          </div>
        ) : null}
      </div>
      <div className="nv-card">
        <div className="nv-card-body">
          {loadError ? <div className="nv-error">{loadError}</div> : null}
          {!page && !loadError ? <p>Loading…</p> : null}
          {page ? (
            <PageForm
              initial={{ title: page.title, path: page.path }}
              initialTreeText={stringifyTree(page.tree)}
              busy={busy}
              error={error}
              submitLabel="Save changes"
              onSubmit={onSubmit}
            >
              <Field label="ID">
                <span className="nv-code">{page.id}</span>
              </Field>
              <Field label="External reference code">
                <span className="nv-code">{page.externalReferenceCode}</span>
              </Field>
            </PageForm>
          ) : null}
        </div>
      </div>
    </>
  );
}
