'use client';

import type { components } from '@neriva/contracts';
import { useRouter } from 'next/navigation';
import { useToast } from '../../../../components/toast';
import { api } from '../../../../lib/api';
import { StyleBookForm, type StyleBookDraft } from '../style-book-form';

type StyleBook = components['schemas']['StyleBookDto'];

export default function NewStyleBookPage() {
  const router = useRouter();
  const toast = useToast();

  async function onSubmit(draft: StyleBookDraft) {
    const { data } = await api.post<{ data: StyleBook }>('/style-books', draft);
    toast.success('Style book created');
    router.push(`/admin/style-book/${data.id}`);
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1>New style book</h1>
      </div>
      <div className="nv-card">
        <div className="nv-card-body">
          <StyleBookForm submitLabel="Create" onSubmit={onSubmit} />
        </div>
      </div>
    </>
  );
}
