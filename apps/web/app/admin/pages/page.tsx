'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { type Column, DataTable, LoadMore, useCursorList } from '../../../components/data-table';
import { Button, Field } from '../../../components/form';
import { useToast } from '../../../components/toast';
import { ApiError, api } from '../../../lib/api';
import type { Page, Site } from './types';

const COLUMNS: Column<Page>[] = [
  { key: 'title', header: 'Title', render: (row) => row.title },
  { key: 'path', header: 'Path', render: (row) => <span className="nv-code">{row.path}</span> },
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
    key: 'updatedAt',
    header: 'Updated',
    render: (row) => new Date(row.updatedAt).toLocaleString(),
  },
];

function SitePages({ siteId }: { siteId: string }) {
  const toast = useToast();
  const { items, loading, hasMore, refresh, loadMore } = useCursorList<Page>(
    `/sites/${siteId}/pages`,
    (error) => toast.error(error.message),
  );

  async function onPublish(page: Page) {
    if (!window.confirm(`Publish page "${page.title}"?`)) {
      return;
    }
    try {
      await api.post(`/pages/${page.id}/publish`);
      toast.success('Page published');
      await refresh();
    } catch (error) {
      // The problem detail carries tree validation pointers on 400.
      toast.error(error instanceof ApiError ? error.message : 'Failed to publish page');
    }
  }

  async function onDelete(page: Page) {
    if (!window.confirm(`Delete page "${page.title}"? This cannot be undone.`)) {
      return;
    }
    try {
      await api.del(`/pages/${page.id}`);
      toast.success('Page deleted');
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to delete page');
    }
  }

  return (
    <>
      <DataTable
        columns={COLUMNS}
        rows={items}
        loading={loading}
        emptyMessage="No pages in this site yet. Create the first one."
        rowActions={(row) => (
          <>
            <Link className="nv-button" data-variant="secondary" href={`/admin/pages/${row.id}`}>
              Edit
            </Link>
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

export default function PagesListPage() {
  const toast = useToast();
  const [sites, setSites] = useState<Site[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [siteId, setSiteId] = useState('');

  useEffect(() => {
    api
      .get<{ data: Site[] }>('/sites?limit=100')
      .then(({ data }) => setSites(data))
      .catch((error: unknown) => {
        toast.error(error instanceof ApiError ? error.message : 'Failed to load sites');
      })
      .finally(() => setSitesLoading(false));
    // toast is memoized in the provider, so this runs once on mount.
  }, [toast]);

  return (
    <>
      <div className="nv-toolbar">
        <h1>Pages</h1>
        {siteId === '' ? (
          <Button type="button" disabled title="Choose a site first">
            New page
          </Button>
        ) : (
          <Link className="nv-button" href={`/admin/pages/new?site=${siteId}`}>
            New page
          </Link>
        )}
      </div>
      <div className="nv-card" style={{ marginBottom: 'var(--nv-space-4)' }}>
        <div className="nv-card-body nv-form">
          <Field label="Site" htmlFor="site">
            <select
              id="site"
              value={siteId}
              onChange={(event) => setSiteId(event.target.value)}
              disabled={sitesLoading}
            >
              <option value="">{sitesLoading ? 'Loading sites…' : 'Select a site…'}</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>
      {siteId === '' ? (
        <div className="nv-empty">Choose a site to list its pages.</div>
      ) : (
        <SitePages key={siteId} siteId={siteId} />
      )}
    </>
  );
}
