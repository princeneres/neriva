'use client';

import Link from 'next/link';
import { type Column, DataTable, LoadMore, useCursorList } from '../../../components/data-table';
import { Button } from '../../../components/form';
import { useToast } from '../../../components/toast';
import { ApiError, api } from '../../../lib/api';
import type { ObjectDefinition } from './types';

const COLUMNS: Column<ObjectDefinition>[] = [
  { key: 'name', header: 'Name', render: (row) => row.name },
  { key: 'pluralName', header: 'Plural name', render: (row) => row.pluralName },
  { key: 'fields', header: 'Fields', render: (row) => row.fields.length },
  {
    key: 'createdAt',
    header: 'Created',
    render: (row) => new Date(row.createdAt).toLocaleString(),
  },
];

export default function ObjectDefinitionsPage() {
  const toast = useToast();
  const { items, loading, hasMore, refresh, loadMore } = useCursorList<ObjectDefinition>(
    '/object-definitions',
    (error) => toast.error(error.message),
  );

  async function onDelete(definition: ObjectDefinition) {
    if (!window.confirm(`Delete object definition "${definition.name}"?`)) {
      return;
    }
    try {
      await api.del(`/object-definitions/${definition.id}`);
      toast.success('Object definition deleted');
      await refresh();
    } catch (error) {
      // A 409 problem detail (definition still has records) surfaces here.
      toast.error(
        error instanceof ApiError ? error.message : 'Failed to delete the object definition',
      );
    }
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1>Object definitions</h1>
        <Link className="nv-button" href="/admin/objects/new">
          New definition
        </Link>
      </div>
      <DataTable
        columns={COLUMNS}
        rows={items}
        loading={loading}
        emptyMessage="No object definitions yet. Create the first one."
        rowActions={(row) => (
          <>
            <Link
              className="nv-button"
              data-variant="secondary"
              href={`/admin/objects/${row.id}/records`}
            >
              Records
            </Link>
            <Link className="nv-button" data-variant="secondary" href={`/admin/objects/${row.id}`}>
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
