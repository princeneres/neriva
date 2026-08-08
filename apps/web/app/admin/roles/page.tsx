'use client';

import type { components } from '@neriva/contracts';
import Link from 'next/link';
import { type Column, DataTable, LoadMore, useCursorList } from '../../../components/data-table';
import { Button } from '../../../components/form';
import { useToast } from '../../../components/toast';
import { ApiError, api } from '../../../lib/api';

type Role = components['schemas']['RoleDto'];

// The generator types `description` as an object because the spec declares a
// nullable string via a YAML type union; at runtime it is string | null.
function roleDescription(role: Role): string {
  return typeof role.description === 'string' ? role.description : '';
}

const columns: Column<Role>[] = [
  { key: 'name', header: 'Name', render: (row) => row.name },
  { key: 'description', header: 'Description', render: (row) => roleDescription(row) },
  { key: 'permissions', header: 'Permissions', render: (row) => row.permissions.length },
];

export default function RolesPage() {
  const toast = useToast();
  const { items, loading, hasMore, refresh, loadMore } = useCursorList<Role>('/roles', (error) =>
    toast.error(error.message),
  );

  async function onDelete(role: Role) {
    if (!window.confirm(`Delete role "${role.name}"?`)) {
      return;
    }
    try {
      await api.del(`/roles/${role.id}`);
      toast.success('Role deleted');
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Delete failed');
    }
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1>Roles</h1>
        <Link className="nv-button" data-variant="primary" href="/admin/roles/new">
          New role
        </Link>
      </div>
      <DataTable
        columns={columns}
        rows={items}
        loading={loading}
        emptyMessage="No roles yet."
        rowActions={(row) => (
          <>
            <Link
              className="nv-button"
              data-variant="secondary"
              href={`/admin/roles/${encodeURIComponent(row.id)}`}
            >
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
