'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  type Column,
  DataTable,
  LoadMore,
  useCursorList,
} from '../../../../../components/data-table';
import { Button } from '../../../../../components/form';
import { useToast } from '../../../../../components/toast';
import { ApiError, api } from '../../../../../lib/api';
import type { ObjectDefinition, ObjectRecord } from '../../types';

function renderValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return JSON.stringify(value);
}

interface AppliedFilter {
  key: string;
  value: string;
}

export default function ObjectRecordsPage() {
  const toast = useToast();
  const { id } = useParams<{ id: string }>();
  const [definition, setDefinition] = useState<ObjectDefinition | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterKey, setFilterKey] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [applied, setApplied] = useState<AppliedFilter | null>(null);

  useEffect(() => {
    api
      .get<{ data: ObjectDefinition }>(`/object-definitions/${id}`)
      .then(({ data }) => setDefinition(data))
      .catch((err: unknown) => {
        setLoadError(
          err instanceof ApiError ? err.message : 'Failed to load the object definition',
        );
      });
  }, [id]);

  // Spec 05: cursor pagination only supports the default id sort, so the
  // browser keeps the default order and offers no custom sort.
  const listPath = useMemo(() => {
    const base = `/object-definitions/${id}/records`;
    if (!applied) {
      return base;
    }
    const param = encodeURIComponent(`filter[${applied.key}]`);
    return `${base}?${param}=${encodeURIComponent(applied.value)}`;
  }, [id, applied]);

  const { items, loading, hasMore, refresh, loadMore } = useCursorList<ObjectRecord>(
    listPath,
    (error) => toast.error(error.message),
  );

  const columns = useMemo<Column<ObjectRecord>[]>(() => {
    const fieldColumns: Column<ObjectRecord>[] = (definition?.fields ?? []).map((field) => ({
      key: field.key,
      header: field.label,
      render: (row) => renderValue(row.data[field.key]),
    }));
    return [
      ...fieldColumns,
      {
        key: 'createdAt',
        header: 'Created',
        render: (row) => new Date(row.createdAt).toLocaleString(),
      },
    ];
  }, [definition]);

  const filterField = definition?.fields.find((field) => field.key === filterKey) ?? null;

  function applyFilter() {
    if (!filterField || filterValue === '') {
      setApplied(null);
      return;
    }
    setApplied({ key: filterField.key, value: filterValue });
  }

  function clearFilter() {
    setFilterKey('');
    setFilterValue('');
    setApplied(null);
  }

  async function onDelete(record: ObjectRecord) {
    if (!window.confirm('Delete this record?')) {
      return;
    }
    try {
      await api.del(`/object-records/${record.id}`);
      toast.success('Record deleted');
      await refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Failed to delete the record');
    }
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1>{definition ? `${definition.pluralName} records` : 'Records'}</h1>
        <div style={{ display: 'flex', gap: 'var(--nv-space-2)' }}>
          <Link className="nv-button" data-variant="secondary" href="/admin/objects">
            Back to definitions
          </Link>
          <Link className="nv-button" href={`/admin/objects/${id}/records/new`}>
            New record
          </Link>
        </div>
      </div>
      {loadError ? <div className="nv-error">{loadError}</div> : null}
      {definition ? (
        <div
          className="nv-toolbar"
          style={{ display: 'flex', gap: 'var(--nv-space-2)', alignItems: 'center' }}
        >
          <select
            aria-label="Filter field"
            value={filterKey}
            onChange={(e) => {
              setFilterKey(e.target.value);
              setFilterValue('');
            }}
          >
            <option value="">Filter by…</option>
            {definition.fields.map((field) => (
              <option key={field.key} value={field.key}>
                {field.label}
              </option>
            ))}
          </select>
          {filterField?.type === 'boolean' ? (
            <select
              aria-label="Filter value"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
            >
              <option value="">Select…</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : filterField?.type === 'picklist' ? (
            <select
              aria-label="Filter value"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
            >
              <option value="">Select…</option>
              {(filterField.options ?? []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              aria-label="Filter value"
              type={
                filterField?.type === 'number'
                  ? 'number'
                  : filterField?.type === 'date'
                    ? 'date'
                    : 'text'
              }
              placeholder="Value"
              disabled={!filterField}
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
            />
          )}
          <Button
            type="button"
            variant="secondary"
            disabled={!filterField || filterValue === ''}
            onClick={applyFilter}
          >
            Apply
          </Button>
          {applied ? (
            <Button type="button" variant="secondary" onClick={clearFilter}>
              Clear
            </Button>
          ) : null}
        </div>
      ) : null}
      {definition ? (
        <DataTable
          columns={columns}
          rows={items}
          loading={loading}
          emptyMessage={applied ? 'No records match the filter.' : 'No records yet.'}
          rowActions={(row) => (
            <>
              <Link
                className="nv-button"
                data-variant="secondary"
                href={`/admin/objects/records/${row.id}`}
              >
                Edit
              </Link>
              <Button type="button" variant="danger" onClick={() => void onDelete(row)}>
                Delete
              </Button>
            </>
          )}
        />
      ) : !loadError ? (
        <p>Loading…</p>
      ) : null}
      {definition ? (
        <LoadMore hasMore={hasMore} loading={loading} onClick={() => void loadMore()} />
      ) : null}
    </>
  );
}
