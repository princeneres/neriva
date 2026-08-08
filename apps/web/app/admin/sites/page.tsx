'use client';

import Link from 'next/link';
import { type Column, DataTable, LoadMore, useCursorList } from '../../../components/data-table';
import { Button } from '../../../components/form';
import { useToast } from '../../../components/toast';
import { ApiError, api } from '../../../lib/api';
import type { Site } from './types';

const COLUMNS: Column<Site>[] = [
  { key: 'name', header: 'Name', render: (row) => row.name },
  { key: 'slug', header: 'Slug', render: (row) => <span className="nv-code">{row.slug}</span> },
  { key: 'description', header: 'Description', render: (row) => row.description ?? '' },
  {
    key: 'createdAt',
    header: 'Created',
    render: (row) => new Date(row.createdAt).toLocaleString(),
  },
];

export default function SitesPage() {
  const toast = useToast();
  const { items, loading, hasMore, refresh, loadMore } = useCursorList<Site>('/sites', (error) =>
    toast.error(error.message),
  );

  async function onDelete(site: Site) {
    if (!window.confirm(`Delete site "${site.name}"?`)) {
      return;
    }
    try {
      await api.del(`/sites/${site.id}`);
      toast.success('Site deleted');
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to delete site');
    }
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1>Sites</h1>
        <Link className="nv-button" href="/admin/sites/new">
          New site
        </Link>
      </div>
      <DataTable
        columns={COLUMNS}
        rows={items}
        loading={loading}
        emptyMessage="No sites yet. Create the first one."
        rowActions={(row) => (
          <>
            <Link className="nv-button" data-variant="secondary" href={`/admin/sites/${row.id}`}>
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
