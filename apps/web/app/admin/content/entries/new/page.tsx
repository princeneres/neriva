'use client';

import type { components } from '@neriva/contracts';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useToast } from '../../../../../components/toast';
import { ApiError, api } from '../../../../../lib/api';
import type { ContentEntry, ContentType } from '../../types';
import { EntryForm, type EntryFormValues } from '../entry-form';

type CreateContentEntryDto = components['schemas']['CreateContentEntryDto'];

function NewEntry() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const typeRef = searchParams.get('type');
  const [contentType, setContentType] = useState<ContentType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!typeRef) {
      return;
    }
    api
      .get<{ data: ContentType }>(`/content-types/${encodeURIComponent(typeRef)}`)
      .then(({ data }) => setContentType(data))
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load content type');
      });
  }, [typeRef]);

  if (!typeRef) {
    return (
      <div className="nv-error">
        Missing content type. Go back to <Link href="/admin/content/entries">content entries</Link>{' '}
        and select a type first.
      </div>
    );
  }

  async function onSubmit(values: EntryFormValues) {
    if (!contentType) {
      return;
    }
    const body: CreateContentEntryDto = {
      contentType: contentType.id,
      title: values.title,
      values: values.values,
    };
    await api.post<{ data: ContentEntry }>('/content-entries', body);
    toast.success('Entry created');
    router.push('/admin/content/entries');
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1>New entry{contentType ? `: ${contentType.name}` : ''}</h1>
      </div>
      {loadError ? <div className="nv-error">{loadError}</div> : null}
      {contentType ? (
        <EntryForm
          contentType={contentType}
          submitLabel="Create entry"
          busyLabel="Creating…"
          onSubmit={onSubmit}
        />
      ) : !loadError ? (
        <p>Loading…</p>
      ) : null}
    </>
  );
}

export default function NewEntryPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <NewEntry />
    </Suspense>
  );
}
