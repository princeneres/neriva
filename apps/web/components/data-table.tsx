'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api, type ListMeta } from '../lib/api';

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
