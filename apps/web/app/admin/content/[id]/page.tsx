'use client';

import type { components } from '@neriva/contracts';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useToast } from '../../../../components/toast';
import { ApiError, api } from '../../../../lib/api';
import { ContentTypeForm, type ContentTypeFormValues } from '../content-type-form';
import type { ContentType } from '../types';

type UpdateContentTypeDto = components['schemas']['UpdateContentTypeDto'];

export default function EditContentTypePage() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useParams<{ id: string }>();
  const [initial, setInitial] = useState<ContentTypeFormValues | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: ContentType }>(`/content-types/${encodeURIComponent(id)}`)
      .then(({ data }) => {
        setInitial({
          name: data.name,
          description: data.description ?? '',
          fields: data.fields,
        });
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load content type');
      });
  }, [id]);

  async function onSubmit(values: ContentTypeFormValues) {
    const body: UpdateContentTypeDto = {
      name: values.name,
      description: values.description.trim(),
      fields: values.fields,
    };
    await api.patch<{ data: ContentType }>(`/content-types/${encodeURIComponent(id)}`, body);
    toast.success('Content type updated');
    router.push('/admin/content');
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1>Edit content type</h1>
      </div>
      {loadError ? <div className="nv-error">{loadError}</div> : null}
      {initial ? (
        <ContentTypeForm
          initial={initial}
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
