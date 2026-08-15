// Process-lived cache of admin API reads, shared by every screen in one
// browser session. Admin screens are client components that fetch on mount, so
// without this every navigation back to a list drops to a skeleton and waits
// for a round trip it already made. Screens read the previous payload
// synchronously, render it, and revalidate in the background.
//
// This is deliberately not a data-fetching library: no request dedup, no
// staleness policy, no subscriptions. Entries are overwritten by the
// revalidation that follows every read and dropped wholesale on logout.

const MAX_ENTRIES = 64;

const store = new Map<string, unknown>();

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
}

export const CACHE_MAX_ENTRIES = MAX_ENTRIES;
