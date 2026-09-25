// Process-lived cache of admin API reads, shared by every screen in one
// browser session. Admin screens are client components that fetch on mount, so
// without this every navigation back to a list drops to a skeleton and waits
// for a round trip it already made. Screens read the previous payload
// synchronously, render it, and revalidate in the background.
//
// This is deliberately not a data-fetching library: no staleness policy, no
// subscriptions. Entries are overwritten by the revalidation that follows every
// read and dropped wholesale on logout. The one request-level concern that does
// live here is in-flight sharing, below.

const MAX_ENTRIES = 64;

const store = new Map<string, unknown>();

// Reads that have been sent but have not answered yet, keyed by request.
// Independent of the payload cache: a key is here only while its round trip is
// open.
const inFlight = new Map<string, Promise<unknown>>();

// Map iteration order is insertion order, so re-inserting on read turns the
// map into an LRU and the eviction below drops the least recently used key.
export function readCache<T>(key: string): T | undefined {
  if (!store.has(key)) {
    return undefined;
  }
  const value = store.get(key) as T;
  store.delete(key);
  store.set(key, value);
  return value;
}

export function writeCache<T>(key: string, value: T): void {
  store.delete(key);
  store.set(key, value);
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next();
    if (oldest.done) {
      return;
    }
    store.delete(oldest.value);
  }
}

// Drops one entry. Used when a mutation makes a cached payload wrong and no
// revalidation of that key is about to happen.
export function invalidateCache(key: string): void {
  store.delete(key);
}

// Logout: nothing cached under the previous session may survive into the next.
export function clearCache(): void {
  store.clear();
  inFlight.clear();
}

export const CACHE_MAX_ENTRIES = MAX_ENTRIES;

// Shares one round trip between callers that ask for the same thing before the
// first answer arrives. The admin mounts a screen and its shell together, so
// two components regularly request the same URL in the same tick (the media
// screen and its folder drawer both open on the root folder); without this each
// one opens its own connection for an identical answer.
//
// Joiners resolve with the same value object, so callers must treat a response
// as read-only, which every screen already does.
export function dedupeInFlight<T>(key: string, send: () => Promise<T>): Promise<T> {
  const open = inFlight.get(key) as Promise<T> | undefined;
  if (open) {
    return open;
  }
  const started = send().finally(() => {
    // Only drop the entry this call created: a later request may already own
    // the key, and clearCache may have dropped it at logout.
    if (inFlight.get(key) === started) {
      inFlight.delete(key);
    }
  });
  inFlight.set(key, started);
  return started;
}

// Open round trips, for tests and for asserting that nothing leaks.
export function inFlightCount(): number {
  return inFlight.size;
}
