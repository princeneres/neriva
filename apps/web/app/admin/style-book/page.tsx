'use client';

import type { components } from '@neriva/contracts';
import { useRouter } from 'next/navigation';
import { Button } from '../../../components/form';
import { DataTable, LoadMore, useCursorList, type Column } from '../../../components/data-table';
import { useToast } from '../../../components/toast';
import { ApiError, api } from '../../../lib/api';

type StyleBook = components['schemas']['StyleBookDto'];

export default function StyleBookListPage() {
  const router = useRouter();
  const toast = useToast();
  const { items, loading, hasMore, refresh, loadMore } = useCursorList<StyleBook>(
    '/style-books',
    (error) => toast.error(error.message),
  );

  const columns: Column<StyleBook>[] = [
    { key: 'name', header: 'Name', render: (row) => row.name },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className="nv-badge" data-status={row.status}>
          {row.status}
        </span>
      ),
    },
    { key: 'version', header: 'Version', render: (row) => row.version },
    { key: 'tokens', header: 'Tokens', render: (row) => Object.keys(row.tokens).length },
    {
      key: 'updatedAt',
      header: 'Updated',
      render: (row) => new Date(row.updatedAt).toLocaleString(),
    },
  ];

  async function onPublish(row: StyleBook) {
    if (!window.confirm(`Publish "${row.name}"? Publishing increments the version.`)) {
      return;
    }
    try {
      await api.post(`/style-books/${row.id}/publish`);
      toast.success('Style book published');
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to publish style book');
    }
  }

  async function onDelete(row: StyleBook) {
    if (!window.confirm(`Delete "${row.name}"? This cannot be undone.`)) {
      return;
    }
    try {
      await api.del(`/style-books/${row.id}`);
      toast.success('Style book deleted');
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to delete style book');
    }
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1>Style Book</h1>
        <Button type="button" onClick={() => router.push('/admin/style-book/new')}>
          New style book
        </Button>
      </div>
      <DataTable
        columns={columns}
        rows={items}
        loading={loading}
        emptyMessage="No style books yet. Create the first one."
        rowActions={(row) => (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(`/admin/style-book/${row.id}`)}
            >
              Edit
            </Button>
            <Button type="button" variant="secondary" onClick={() => void onPublish(row)}>
              Publish
            </Button>
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
