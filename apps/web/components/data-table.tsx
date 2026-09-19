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

interface CursorPageState<T> {
  path: string;
  items: T[];
  startCursor: string | null;
  nextCursor: string | null;
  previousStarts: (string | null)[];
  page: number;
  limit: number;
  loading: boolean;
}

const DEFAULT_CURSOR_PAGE_LIMIT = 20;

function pageSeed<T>(path: string, limit = DEFAULT_CURSOR_PAGE_LIMIT): CursorPageState<T> {
  return {
    path,
    items: [],
    startCursor: null,
    nextCursor: null,
    previousStarts: [],
    page: 1,
    limit,
    loading: true,
  };
}

function cursorPageUrl(path: string, cursor: string | null, limit: number): string {
  const [basePath, rawQuery = ''] = path.split('?');
  const query = new URLSearchParams(rawQuery);
  query.set('limit', String(limit));
  if (cursor === null) query.delete('cursor');
  else query.set('cursor', cursor);
  return `${basePath}?${query.toString()}`;
}

// Cursor APIs cannot provide offsets or a total page count. This tracks the
// real cursor chain, so previous, first, and last never guess an offset.
export function useCursorPage<T>(
  path: string,
  onError?: (error: ApiError) => void,
  options?: { initialLimit?: number },
) {
  const initialLimit = options?.initialLimit ?? DEFAULT_CURSOR_PAGE_LIMIT;
  const [state, setState] = useState<CursorPageState<T>>(() => pageSeed<T>(path, initialLimit));
  const errorHandler = useRef(onError);
  const requestSequence = useRef(0);
  errorHandler.current = onError;

  const current = state.path === path ? state : pageSeed<T>(path, state.limit);
  if (current !== state) {
    setState(current);
  }

  const load = useCallback(
    async (
      startCursor: string | null,
      previousStarts: (string | null)[],
      page: number,
      limit: number,
    ) => {
      const sequence = ++requestSequence.current;
      setState((existing) => (existing.path === path ? { ...existing, loading: true } : existing));
      try {
        const response = await api.get<ListResponse<T>>(cursorPageUrl(path, startCursor, limit));
        if (sequence !== requestSequence.current) return;
        setState((existing) =>
          existing.path === path
            ? {
                path,
                items: response.data,
                startCursor,
                nextCursor: response.meta.cursor,
                previousStarts,
                page,
                limit: response.meta.limit,
                loading: false,
              }
            : existing,
        );
      } catch (error) {
        if (sequence !== requestSequence.current) return;
        setState((existing) =>
          existing.path === path ? { ...existing, loading: false } : existing,
        );
        if (error instanceof ApiError && errorHandler.current) {
          errorHandler.current(error);
        }
      }
    },
    [path],
  );

  useEffect(() => {
    void load(null, [], 1, current.limit);
  }, [load]);

  const refresh = useCallback(
    () => load(current.startCursor, current.previousStarts, current.page, current.limit),
    [current.limit, current.page, current.previousStarts, current.startCursor, load],
  );
  const first = useCallback(() => load(null, [], 1, current.limit), [current.limit, load]);
  const next = useCallback(() => {
    if (current.nextCursor === null) return;
    return load(
      current.nextCursor,
      [...current.previousStarts, current.startCursor],
      current.page + 1,
      current.limit,
    );
  }, [
    current.limit,
    current.nextCursor,
    current.page,
    current.previousStarts,
    current.startCursor,
    load,
  ]);
  const previous = useCallback(() => {
    if (current.previousStarts.length === 0) return;
    const starts = current.previousStarts.slice(0, -1);
    const startCursor = current.previousStarts[current.previousStarts.length - 1] ?? null;
    return load(startCursor, starts, Math.max(1, current.page - 1), current.limit);
  }, [current.limit, current.page, current.previousStarts, load]);
  const setLimit = useCallback(
    (limit: number) => {
      if (!Number.isInteger(limit) || limit < 1 || limit === current.limit) return;
      return load(null, [], 1, limit);
    },
    [current.limit, load],
  );
  const last = useCallback(async () => {
    if (current.nextCursor === null) return;
    const sequence = ++requestSequence.current;
    setState((existing) => (existing.path === path ? { ...existing, loading: true } : existing));
    try {
      let startCursor: string | null = null;
      let previousStarts: (string | null)[] = [];
      let page = 1;
      for (;;) {
        const response: ListResponse<T> = await api.get<ListResponse<T>>(
          cursorPageUrl(path, startCursor, current.limit),
        );
        if (sequence !== requestSequence.current) return;
        if (response.meta.cursor === null) {
          setState((existing) =>
            existing.path === path
              ? {
                  path,
                  items: response.data,
                  startCursor,
                  nextCursor: null,
                  previousStarts,
                  page,
                  limit: response.meta.limit,
                  loading: false,
                }
              : existing,
          );
          return;
        }
        previousStarts = [...previousStarts, startCursor];
        startCursor = response.meta.cursor;
        page += 1;
      }
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      setState((existing) => (existing.path === path ? { ...existing, loading: false } : existing));
      if (error instanceof ApiError && errorHandler.current) errorHandler.current(error);
    }
  }, [current.limit, current.nextCursor, path]);

  return {
    items: current.items,
    loading: current.loading,
    page: current.page,
    limit: current.limit,
    hasPrevious: current.previousStarts.length > 0,
    hasNext: current.nextCursor !== null,
    refresh,
    first,
    next,
    previous,
    last,
    setLimit,
  };
}
