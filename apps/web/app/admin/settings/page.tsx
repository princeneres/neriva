'use client';

import { useRouter } from 'next/navigation';
import { type Column, DataTable, LoadMore, useCursorList } from '../../../components/data-table';
import { Button } from '../../../components/form';
import { useToast } from '../../../components/toast';
import { ApiError, api } from '../../../lib/api';
import { type SystemSetting, WellKnownKeysCard, previewValue } from './shared';

const COLUMNS: Column<SystemSetting>[] = [
  {
    key: 'key',
    header: 'Key',
    render: (row) => <code className="nv-code">{row.key}</code>,
  },
  {
    key: 'value',
    header: 'Value',
    render: (row) => previewValue(row.value),
  },
  {
    key: 'updatedAt',
    header: 'Updated',
    render: (row) => new Date(row.updatedAt).toLocaleString(),
  },
];

export default function SettingsListPage() {
  const router = useRouter();
  const toast = useToast();
  const { items, loading, hasMore, refresh, loadMore } = useCursorList<SystemSetting>(
    '/system/settings',
    (error) => toast.error(error.message),
  );

  async function onDelete(setting: SystemSetting) {
    if (!window.confirm(`Delete setting "${setting.key}"?`)) {
      return;
    }
    try {
      await api.del(`/system/settings/${encodeURIComponent(setting.key)}`);
      toast.success('Setting deleted');
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Delete failed');
    }
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1>Settings</h1>
        <Button type="button" onClick={() => router.push('/admin/settings/new')}>
          New setting
        </Button>
      </div>
      <DataTable
        columns={COLUMNS}
        rows={items}
        loading={loading}
        emptyMessage="No settings yet."
        rowActions={(row) => (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(`/admin/settings/${encodeURIComponent(row.key)}`)}
            >
              Edit
            </Button>
            <Button type="button" variant="danger" onClick={() => void onDelete(row)}>
              Delete
            </Button>
          </>
        )}
      />
      <LoadMore hasMore={hasMore} loading={loading} onClick={() => void loadMore()} />
      <WellKnownKeysCard />
    </>
  );
}
