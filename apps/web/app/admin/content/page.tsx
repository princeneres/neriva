'use client';

import Link from 'next/link';
import { type Column, DataTable, LoadMore, useCursorList } from '../../../components/data-table';
import { Button } from '../../../components/form';
import { useToast } from '../../../components/toast';
import { ApiError, api } from '../../../lib/api';
import type { ContentType } from './types';

const COLUMNS: Column<ContentType>[] = [
  { key: 'name', header: 'Name', render: (row) => row.name },
  { key: 'description', header: 'Description', render: (row) => row.description ?? '' },
  { key: 'fields', header: 'Fields', render: (row) => row.fields.length },
  {
    key: 'createdAt',
    header: 'Created',
    render: (row) => new Date(row.createdAt).toLocaleString(),
  },
];

export default function ContentTypesPage() {
  const toast = useToast();
  const { items, loading, hasMore, refresh, loadMore } = useCursorList<ContentType>(
    '/content-types',
    (error) => toast.error(error.message),
  );

  async function onDelete(contentType: ContentType) {
    if (!window.confirm(`Delete content type "${contentType.name}"?`)) {
      return;
    }
    try {
      await api.del(`/content-types/${contentType.id}`);
      toast.success('Content type deleted');
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to delete content type');
    }
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1>Content types</h1>
        <div style={{ display: 'flex', gap: 'var(--nv-space-2)' }}>
          <Link className="nv-button" data-variant="secondary" href="/admin/content/entries">
            Entries
          </Link>
          <Link className="nv-button" href="/admin/content/new">
            New content type
          </Link>
        </div>
      </div>
      <DataTable
        columns={COLUMNS}
        rows={items}
        loading={loading}
        emptyMessage="No content types yet. Create the first one."
        rowActions={(row) => (
          <>
            <Link className="nv-button" data-variant="secondary" href={`/admin/content/${row.id}`}>
              Edit
            </Link>
            <Button type="button" variant="danger" onClick={() => void onDelete(row)}>
              Delete
            </Button>
          </>
        )}
      />
      <LoadMore hasMore={hasMore} loading={loading} onClick={() => void loadMore()} />
    </>
  );
}
