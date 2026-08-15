'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api, type ListMeta } from '../lib/api';
import { readCache, writeCache } from '../lib/client-cache';

interface ListResponse<T> {
  data: T[];
  meta: ListMeta;
}

interface CachedPage<T> {
  items: T[];
  cursor: string | null;
}

interface ListState<T> extends CachedPage<T> {
  // The path this state belongs to, so a path change swaps payloads instead of
  // showing the previous screen's rows.
  path: string;
  loading: boolean;
}

function seed<T>(path: string): ListState<T> {
  const cached = readCache<CachedPage<T>>(path);
  return {
    path,
    items: cached?.items ?? [],
    cursor: cached?.cursor ?? null,
    // A cache hit still revalidates, but with rows on screen already: callers
    // gate their skeleton on `items.length === 0`, so nothing flashes.
    loading: true,
  };
}

// Cursor pagination over a list endpoint. `path` may already contain a
// query string; the cursor is appended.
//
// The last payload per path is cached for the browser session, so navigating
// back to a list paints the previous rows immediately and refreshes them in
// place. Pages loaded through `loadMore` are cached too, so a scrolled list
// comes back scrolled.
export function useCursorList<T>(path: string, onError?: (error: ApiError) => void) {
  const [state, setState] = useState<ListState<T>>(() => seed<T>(path));
  const errorHandler = useRef(onError);
  errorHandler.current = onError;

  // Deriving the swap during render (rather than in an effect) keeps the first
  // paint after a path change free of the old list.
  const current = state.path === path ? state : seed<T>(path);
  if (current !== state) {
    setState(current);
  }

  // `loadMore` appends to whatever is on screen now, without making the
  // callback depend on the items and re-run the mount effect on every page.
  const itemsRef = useRef(current.items);
  itemsRef.current = current.items;

  const load = useCallback(
    async (append: boolean, fromCursor: string | null) => {
      setState((s) => (s.path === path && !s.loading ? { ...s, loading: true } : s));
      try {
        const separator = path.includes('?') ? '&' : '?';
        const url = fromCursor
          ? `${path}${separator}cursor=${encodeURIComponent(fromCursor)}`
          : path;
        const page = await api.get<ListResponse<T>>(url);
        const items = append ? [...itemsRef.current, ...page.data] : page.data;
        writeCache<CachedPage<T>>(path, { items, cursor: page.meta.cursor });
        // A response that lands after the caller moved to another path belongs
        // to a list nobody is showing; the cache above still keeps it.
        setState((s) =>
          s.path === path ? { path, items, cursor: page.meta.cursor, loading: false } : s,
        );
      } catch (error) {
        setState((s) => (s.path === path ? { ...s, loading: false } : s));
        if (error instanceof ApiError && errorHandler.current) {
          errorHandler.current(error);
        }
      }
    },
    [path],
  );

  useEffect(() => {
    void load(false, null);
  }, [load]);

  const refresh = useCallback(() => load(false, null), [load]);
  const loadMore = useCallback(() => load(true, current.cursor), [load, current.cursor]);

  return {
    items: current.items,
    loading: current.loading,
    hasMore: current.cursor !== null,
    refresh,
    loadMore,
  };
}
