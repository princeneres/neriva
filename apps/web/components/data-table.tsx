'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, api, type ListMeta } from '../lib/api';
import { Button } from './form';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading,
  emptyMessage,
  rowActions,
}: {
  columns: Column<T>[];
  rows: T[];
  loading: boolean;
  emptyMessage: string;
  rowActions?: (row: T) => ReactNode;
}) {
  return (
    <div className="nv-card">
      <table className="nv-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.header}</th>
            ))}
            {rowActions ? <th aria-label="Actions" /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
              {rowActions ? <td className="nv-table-actions">{rowActions(row)}</td> : null}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td className="nv-table-empty" colSpan={columns.length + (rowActions ? 1 : 0)}>
                {loading ? 'Loading…' : emptyMessage}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

interface ListResponse<T> {
  data: T[];
  meta: ListMeta;
}

// Cursor pagination over a list endpoint. `path` may already contain a
// query string; the cursor is appended.
export function useCursorList<T>(path: string, onError?: (error: ApiError) => void) {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const errorHandler = useRef(onError);
  errorHandler.current = onError;

  const load = useCallback(
    async (append: boolean, fromCursor: string | null) => {
      setLoading(true);
      try {
        const separator = path.includes('?') ? '&' : '?';
        const url = fromCursor
          ? `${path}${separator}cursor=${encodeURIComponent(fromCursor)}`
          : path;
        const page = await api.get<ListResponse<T>>(url);
        setItems((current) => (append ? [...current, ...page.data] : page.data));
        setCursor(page.meta.cursor);
      } catch (error) {
        if (error instanceof ApiError && errorHandler.current) {
          errorHandler.current(error);
        }
      } finally {
        setLoading(false);
      }
    },
    [path],
  );

  useEffect(() => {
    void load(false, null);
  }, [load]);

  const refresh = useCallback(() => load(false, null), [load]);
  const loadMore = useCallback(() => load(true, cursor), [load, cursor]);

  return { items, loading, hasMore: cursor !== null, refresh, loadMore };
}

export function LoadMore({
  hasMore,
  loading,
  onClick,
}: {
  hasMore: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  if (!hasMore) {
    return null;
  }
  return (
    <div className="nv-load-more">
      <Button type="button" variant="secondary" disabled={loading} onClick={onClick}>
        {loading ? 'Loading…' : 'Load more'}
      </Button>
    </div>
  );
}
