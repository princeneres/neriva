import { formatCalendarDate } from './format-date';

// Pure helpers for the nv-post-list block. Kept apart from the component so
// they can be unit tested: only apps/web/lib/**/*.spec.ts runs in the web
// suite, and these are the parts that break silently.

export interface DeliveredEntry {
  id: string;
  externalReferenceCode: string;
  title: string;
  contentType: string;
  values: Record<string, unknown>;
  updatedAt: string;
}

export interface PostListFieldKeys {
  summary: string;
  body: string;
  date: string;
  image: string;
}

export const POST_LIST_DEFAULT_FIELDS: PostListFieldKeys = {
  summary: 'summary',
  body: 'body',
  date: 'publishedOn',
  image: 'thumbnail',
};

export const POST_LIST_DEFAULT_PAGE_SIZE = 6;

const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 24;

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

// An unset or blank field-key prop falls back to the schema default, so an
// author who clears the input gets the sensible behavior instead of a block
// that silently reads a field named "".
export function resolveFieldKeys(props: Record<string, unknown>): PostListFieldKeys {
  return {
    summary: optionalText(props.summaryField) ?? POST_LIST_DEFAULT_FIELDS.summary,
    body: optionalText(props.bodyField) ?? POST_LIST_DEFAULT_FIELDS.body,
    date: optionalText(props.dateField) ?? POST_LIST_DEFAULT_FIELDS.date,
    image: optionalText(props.imageField) ?? POST_LIST_DEFAULT_FIELDS.image,
  };
}

export function resolvePageSize(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return POST_LIST_DEFAULT_PAGE_SIZE;
  }
  return Math.min(MAX_PAGE_SIZE, Math.max(MIN_PAGE_SIZE, Math.trunc(value)));
}

export function entryFieldText(entry: DeliveredEntry, key: string): string | null {
  return optionalText(entry.values[key]);
}

export function formatPostDate(value: string | null, locale = 'en-US'): string | null {
  return formatCalendarDate(value, { year: 'numeric', month: 'short', day: 'numeric' }, locale);
}

export interface PostListQuery {
  siteSlug: string;
  contentType: string | null;
  search: string;
  pageSize: number;
  cursor: string | null;
}

export function buildPostListPath(query: PostListQuery): string {
  const params = new URLSearchParams();
  params.set('limit', String(query.pageSize));
  const contentType = optionalText(query.contentType);
  if (contentType !== null) {
    params.set('contentType', contentType);
  }
  const search = query.search.trim();
  if (search !== '') {
    params.set('q', search);
  }
  if (query.cursor !== null) {
    params.set('cursor', query.cursor);
  }
  return `/public/sites/${encodeURIComponent(query.siteSlug)}/content-entries?${params.toString()}`;
}

// The delivery API's cursor pagination is forward only, so going back means
// remembering where each visited page started. The stack holds the cursor used
// to load every page before the current one, newest last.
export interface CursorPager {
  cursor: string | null;
  stack: readonly (string | null)[];
}

export const INITIAL_PAGER: CursorPager = { cursor: null, stack: [] };

export function nextPage(pager: CursorPager, nextCursor: string | null): CursorPager {
  if (nextCursor === null) {
    return pager;
  }
  return { cursor: nextCursor, stack: [...pager.stack, pager.cursor] };
}

export function previousPage(pager: CursorPager): CursorPager {
  if (pager.stack.length === 0) {
    return INITIAL_PAGER;
  }
  const stack = pager.stack.slice(0, -1);
  const cursor = pager.stack[pager.stack.length - 1] ?? null;
  return { cursor, stack };
}

export function hasPreviousPage(pager: CursorPager): boolean {
  return pager.stack.length > 0;
}
