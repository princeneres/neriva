'use client';

import type { components } from '@neriva/contracts';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '../../../../../components/form';
import { useToast } from '../../../../../components/toast';
import { ApiError, api } from '../../../../../lib/api';
import type { ContentEntry, ContentType } from '../../types';
import { EntryForm, type EntryFormValues } from '../entry-form';

type UpdateContentEntryDto = components['schemas']['UpdateContentEntryDto'];

export default function EditEntryPage() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useParams<{ id: string }>();
  const [entry, setEntry] = useState<ContentEntry | null>(null);
  const [contentType, setContentType] = useState<ContentType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: ContentEntry }>(`/content-entries/${encodeURIComponent(id)}`)
      .then(async ({ data }) => {
        const type = await api.get<{ data: ContentType }>(`/content-types/${data.contentTypeId}`);
        if (!cancelled) {
          setEntry(data);
          setContentType(type.data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : 'Failed to load entry');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onSubmit(values: EntryFormValues) {
    const body: UpdateContentEntryDto = {
      title: values.title,
      values: values.values,
    };
    await api.patch<{ data: ContentEntry }>(`/content-entries/${encodeURIComponent(id)}`, body);
    toast.success('Entry updated');
    router.push('/admin/content/entries');
  }

  async function onPublish() {
    if (!entry || !window.confirm(`Publish entry "${entry.title}"?`)) {
      return;
    }
    setPublishing(true);
    try {
      const { data } = await api.post<{ data: ContentEntry }>(
        `/content-entries/${encodeURIComponent(id)}/publish`,
      );
      setEntry(data);
      toast.success('Entry published');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to publish entry');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1 style={{ display: 'flex', gap: 'var(--nv-space-2)', alignItems: 'center' }}>
          Edit entry
          {entry ? (
            <span className="nv-badge" data-status={entry.status}>
              {entry.status}
            </span>
          ) : null}
        </h1>
        {entry && entry.status !== 'PUBLISHED' ? (
          <Button type="button" disabled={publishing} onClick={() => void onPublish()}>
            {publishing ? 'Publishing…' : 'Publish'}
          </Button>
        ) : null}
      </div>
      {loadError ? <div className="nv-error">{loadError}</div> : null}
      {entry && contentType ? (
        <EntryForm
          contentType={contentType}
          initial={{ title: entry.title, values: entry.values }}
          submitLabel="Save changes"
          busyLabel="Saving…"
          onSubmit={onSubmit}
        />
      ) : !loadError ? (
        <p>Loading…</p>
      ) : null}
    </>
  );
}
