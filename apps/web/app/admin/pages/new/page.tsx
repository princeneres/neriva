'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useToast } from '../../../../components/toast';
import { ApiError, api } from '../../../../lib/api';
import { PageForm, type PageFormValues } from '../page-form';
import type { Page } from '../types';

function NewPageForm() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const siteId = searchParams.get('site');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  if (!siteId) {
    return (
      <div className="nv-error">
        Missing site. Go back to <Link href="/admin/pages">Pages</Link> and choose a site first.
      </div>
    );
  }

  async function onSubmit(values: PageFormValues) {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post<{ data: Page }>(`/sites/${siteId}/pages`, values);
      toast.success('Page created');
      router.push(`/admin/pages/${data.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError({ status: 0, detail: 'Request failed' }),
      );
      setBusy(false);
    }
  }

  return <PageForm busy={busy} error={error} submitLabel="Create page" onSubmit={onSubmit} />;
}

export default function NewPagePage() {
  return (
    <>
      <div className="nv-toolbar">
        <h1>New page</h1>
      </div>
      <div className="nv-card">
        <div className="nv-card-body">
          <Suspense fallback={<p>Loading…</p>}>
            <NewPageForm />
          </Suspense>
        </div>
      </div>
    </>
  );
}
