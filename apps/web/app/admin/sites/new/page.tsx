'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useToast } from '../../../../components/toast';
import { ApiError, api } from '../../../../lib/api';
import { SiteForm, type SiteFormValues } from '../site-form';
import type { Site } from '../types';

export default function NewSitePage() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function onSubmit(values: SiteFormValues) {
    setBusy(true);
    setError(null);
    try {
      const description = values.description.trim();
      await api.post<{ data: Site }>('/sites', {
        name: values.name,
        slug: values.slug,
        ...(description ? { description } : {}),
      });
      toast.success('Site created');
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
        <h1>New site</h1>
      </div>
      <div className="nv-card">
        <div className="nv-card-body">
          <SiteForm busy={busy} error={error} submitLabel="Create site" onSubmit={onSubmit} />
        </div>
      </div>
    </>
  );
}
