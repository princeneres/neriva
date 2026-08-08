'use client';

import type { components } from '@neriva/contracts';
import { useRouter } from 'next/navigation';
import { useToast } from '../../../../components/toast';
import { api } from '../../../../lib/api';
import { ContentTypeForm, type ContentTypeFormValues } from '../content-type-form';
import type { ContentType } from '../types';

type CreateContentTypeDto = components['schemas']['CreateContentTypeDto'];

export default function NewContentTypePage() {
  const router = useRouter();
  const toast = useToast();

  async function onSubmit(values: ContentTypeFormValues) {
    const body: CreateContentTypeDto = {
      name: values.name,
      ...(values.description.trim() ? { description: values.description.trim() } : {}),
      fields: values.fields,
    };
    await api.post<{ data: ContentType }>('/content-types', body);
    toast.success('Content type created');
    router.push('/admin/content');
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1>New content type</h1>
      </div>
      <ContentTypeForm
        submitLabel="Create content type"
        busyLabel="Creating…"
        onSubmit={onSubmit}
      />
    </>
  );
}
