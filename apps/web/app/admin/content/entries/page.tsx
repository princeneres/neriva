'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { type Column, DataTable, LoadMore, useCursorList } from '../../../../components/data-table';
import { Button } from '../../../../components/form';
import { useToast } from '../../../../components/toast';
import { ApiError, api, type ListMeta } from '../../../../lib/api';
import type { ContentEntry, ContentType } from '../types';

const COLUMNS: Column<ContentEntry>[] = [
  { key: 'title', header: 'Title', render: (row) => row.title },
  {
    key: 'status',
    header: 'Status',
    render: (row) => (
      <span className="nv-badge" data-status={row.status}>
        {row.status}
      </span>
    ),
  },
  {
    key: 'site',
    header: 'Site',
    render: (row) => (row.siteId ? <span className="nv-code">{row.siteId}</span> : '-'),
  },
  {
    key: 'updatedAt',
    header: 'Updated',
    render: (row) => new Date(row.updatedAt).toLocaleString(),
  },
];

export default function ContentEntriesPage() {
  const toast = useToast();
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    api
      .get<{ data: ContentType[]; meta: ListMeta }>('/content-types?limit=100')
      .then(({ data }) => setContentTypes(data))
      .catch((err: unknown) => {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load content types');
      });
  }, [toast]);

  const listPath = useMemo(
    () =>
      typeFilter
        ? `/content-entries?contentType=${encodeURIComponent(typeFilter)}`
        : '/content-entries',
    [typeFilter],
  );

  const { items, loading, hasMore, refresh, loadMore } = useCursorList<ContentEntry>(
    listPath,
    (error) => toast.error(error.message),
  );

  async function onDelete(entry: ContentEntry) {
    if (!window.confirm(`Delete entry "${entry.title}"?`)) {
      return;
    }
    try {
      await api.del(`/content-entries/${entry.id}`);
      toast.success('Entry deleted');
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to delete entry');
    }
  }

  async function onPublish(entry: ContentEntry) {
    if (!window.confirm(`Publish entry "${entry.title}"?`)) {
      return;
    }
    try {
      await api.post<{ data: ContentEntry }>(`/content-entries/${entry.id}/publish`);
      toast.success('Entry published');
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to publish entry');
    }
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1>Content entries</h1>
        <div style={{ display: 'flex', gap: 'var(--nv-space-2)', alignItems: 'center' }}>
          <select
            aria-label="Filter by content type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All content types</option>
            {contentTypes.map((contentType) => (
              <option key={contentType.id} value={contentType.id}>
                {contentType.name}
              </option>
            ))}
          </select>
          <Link className="nv-button" data-variant="secondary" href="/admin/content">
            Content types
          </Link>
          {typeFilter ? (
            <Link
              className="nv-button"
              href={`/admin/content/entries/new?type=${encodeURIComponent(typeFilter)}`}
            >
              New entry
            </Link>
          ) : (
            <Button type="button" disabled title="Select a content type first">
              New entry
            </Button>
          )}
        </div>
      </div>
      <DataTable
        columns={COLUMNS}
        rows={items}
        loading={loading}
        emptyMessage="No entries found."
        rowActions={(row) => (
          <>
            <Link
              className="nv-button"
              data-variant="secondary"
              href={`/admin/content/entries/${row.id}`}
            >
              Edit
            </Link>
            {row.status !== 'PUBLISHED' ? (
              <Button type="button" variant="secondary" onClick={() => void onPublish(row)}>
                Publish
              </Button>
            ) : null}
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
