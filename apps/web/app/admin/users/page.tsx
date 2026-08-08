'use client';

import Link from 'next/link';
import { type Column, DataTable, LoadMore, useCursorList } from '../../../components/data-table';
import { Button } from '../../../components/form';
import { useToast } from '../../../components/toast';
import { ApiError, api, type PublicUser } from '../../../lib/api';

const columns: Column<PublicUser>[] = [
  { key: 'email', header: 'Email', render: (row) => row.email },
  { key: 'displayName', header: 'Display name', render: (row) => row.displayName },
  {
    key: 'mustChangePassword',
    header: 'Must change password',
    render: (row) => <span className="nv-badge">{row.mustChangePassword ? 'Yes' : 'No'}</span>,
  },
  {
    key: 'createdAt',
    header: 'Created',
    render: (row) => new Date(row.createdAt).toLocaleString(),
  },
];

export default function UsersPage() {
  const toast = useToast();
  const { items, loading, hasMore, refresh, loadMore } = useCursorList<PublicUser>(
    '/users',
    (error) => toast.error(error.message),
  );

  async function onDelete(user: PublicUser) {
    if (!window.confirm(`Delete user "${user.email}"?`)) {
      return;
    }
    try {
      await api.del(`/users/${user.id}`);
      toast.success('User deleted');
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Delete failed');
    }
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1>Users</h1>
        <div className="nv-form-actions">
          <Link className="nv-button" data-variant="secondary" href="/admin/roles">
            Manage roles
          </Link>
          <Link className="nv-button" data-variant="primary" href="/admin/users/new">
            New user
          </Link>
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={items}
        loading={loading}
        emptyMessage="No users yet."
        rowActions={(row) => (
          <>
            <Link
              className="nv-button"
              data-variant="secondary"
              href={`/admin/users/${encodeURIComponent(row.id)}`}
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
