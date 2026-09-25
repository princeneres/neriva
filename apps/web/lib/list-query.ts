// Admin list screens send their filters to the server, so the filters have to
// travel in the request path. That path is also the identity of a
// useCursorPage/useCursorList state and the key of the client cache
// (lib/client-cache.ts), which is why the search term must go through here
// rather than into a separate fetch argument: a filtered listing then gets its
// own cache entry instead of overwriting the unfiltered one.

// Long enough that a typed word is one request, short enough to feel live.
export const SEARCH_DEBOUNCE_MS = 300;

// Adds or replaces query parameters on a list path. A blank or whitespace-only
// value removes the parameter, so an empty search box yields the plain path and
// reuses the unfiltered cache entry.
export function buildListPath(
  base: string,
  params: Record<string, string | null | undefined>,
): string {
  const [path = '', rawQuery = ''] = base.split('?');
  const query = new URLSearchParams(rawQuery);
  for (const [key, value] of Object.entries(params)) {
    const trimmed = value?.trim();
    if (trimmed) {
      query.set(key, trimmed);
    } else {
      query.delete(key);
    }
  }
  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}

// True while a search term is in effect, so a screen can tell "nothing here
// yet" apart from "nothing matched".
export function isSearching(term: string | null | undefined): boolean {
  return (term ?? '').trim() !== '';
}
