'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Field } from '../../../../components/form';
import { useToast } from '../../../../components/toast';
import { ApiError, api } from '../../../../lib/api';
import { SiteForm, type SiteFormValues } from '../site-form';
import type { Site } from '../types';

export default function EditSitePage() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useParams<{ id: string }>();
  const [site, setSite] = useState<Site | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    api
      .get<{ data: Site }>(`/sites/${id}`)
      .then(({ data }) => setSite(data))
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load site');
      });
  }, [id]);

  async function onSubmit(values: SiteFormValues) {
    setBusy(true);
    setError(null);
    try {
      const description = values.description.trim();
      await api.patch<{ data: Site }>(`/sites/${id}`, {
        name: values.name,
        slug: values.slug,
        description: description === '' ? null : description,
      });
      toast.success('Site updated');
      router.push('/admin/sites');
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError({ status: 0, detail: 'Request failed' }),
      );
      setBusy(false);
    }
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1>Edit site</h1>
      </div>
      <div className="nv-card">
        <div className="nv-card-body">
          {loadError ? <div className="nv-error">{loadError}</div> : null}
          {!site && !loadError ? <p>Loading…</p> : null}
          {site ? (
            <SiteForm
              initial={{
                name: site.name,
                slug: site.slug,
                description: site.description ?? '',
              }}
              busy={busy}
              error={error}
              submitLabel="Save changes"
              onSubmit={onSubmit}
            >
              <Field label="ID">
                <span className="nv-code">{site.id}</span>
              </Field>
              <Field label="External reference code">
                <span className="nv-code">{site.externalReferenceCode}</span>
              </Field>
            </SiteForm>
          ) : null}
        </div>
      </div>
    </>
  );
}
