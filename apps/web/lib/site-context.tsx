'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';
import { apiUrl } from './api-url';
import { readCache, writeCache } from './client-cache';

export interface SiteSummary {
  id: string;
  name: string;
  slug: string;
}

// Both reads are session-stable, so the shell paints its site switcher from
// the previous answer instead of waiting on two round trips per navigation.
const SITES_CACHE_KEY = 'site-context:sites';
const DEFAULT_SLUG_CACHE_KEY = 'site-context:defaultSlug';

interface SiteContextValue {
  sites: SiteSummary[];
  loading: boolean;
  // The globally selected site every site-scoped screen works against.
  current: SiteSummary | null;
  // Slug of the default site the web root serves (spec 13); null until
  // known or when no site exists.
  defaultSlug: string | null;
  select: (id: string | null) => void;
  refresh: () => Promise<void>;
}

const SiteContext = createContext<SiteContextValue | null>(null);
const STORAGE_KEY = 'neriva.currentSiteId';

// Server render has no localStorage; the client re-derives on hydration.
function readStoredSiteId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem(STORAGE_KEY);
}

// The active site: an explicit pick that still exists wins, otherwise the
// first site, so site-scoped screens are usable without a manual choice.
function pickCurrentId(sites: SiteSummary[], previous?: string | null): string | null {
  if (sites.length === 0) {
    return null;
  }
  const wanted = previous ?? readStoredSiteId();
  return sites.find((s) => s.id === wanted)?.id ?? sites[0]?.id ?? null;
}

export function SiteProvider({ children }: { children: ReactNode }) {
  const cachedSites = readCache<SiteSummary[]>(SITES_CACHE_KEY);
  const [sites, setSites] = useState<SiteSummary[]>(cachedSites ?? []);
  // Site-scoped screens wait on `loading` before firing their own request; a
  // cache hit lets them start immediately instead of after this round trip.
  const [loading, setLoading] = useState(cachedSites === undefined);
  const [currentId, setCurrentId] = useState<string | null>(
    () => pickCurrentId(cachedSites ?? []) ?? null,
  );
  const [defaultSlug, setDefaultSlug] = useState<string | null>(
    () => readCache<string>(DEFAULT_SLUG_CACHE_KEY) ?? null,
  );

  useEffect(() => {
    // Anonymous delivery endpoint; the Visit link falls back to /s/<slug>
    // while (or if) this is unknown. Independent of the sites list below, so
    // the two run side by side rather than in sequence.
    fetch(apiUrl('/public/site'))
      .then(async (res) => {
        if (!res.ok) {
          return;
        }
        const body = (await res.json()) as { data: { slug: string } };
        writeCache(DEFAULT_SLUG_CACHE_KEY, body.data.slug);
        setDefaultSlug(body.data.slug);
      })
      .catch(() => undefined);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const page = await api.get<{ data: SiteSummary[] }>('/sites?limit=100');
      writeCache(SITES_CACHE_KEY, page.data);
      setSites(page.data);
      setCurrentId((previous) => pickCurrentId(page.data, previous));
    } catch {
      setSites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const select = useCallback((id: string | null) => {
    setCurrentId(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const value = useMemo<SiteContextValue>(
    () => ({
      sites,
      loading,
      current: sites.find((s) => s.id === currentId) ?? null,
      defaultSlug,
      select,
      refresh,
    }),
    [sites, loading, currentId, defaultSlug, select, refresh],
  );

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteContextValue {
  const value = useContext(SiteContext);
  if (!value) {
    throw new Error('useSite must be used inside SiteProvider');
  }
  return value;
}

// Public URL of a page served by the delivery runtime.
export function publicPageUrl(siteSlug: string, path: string): string {
  return `/s/${siteSlug}${path === '/' ? '' : path}`;
}

// The default site lives at the web root (spec 13); other sites keep
// their explicit /s/<slug> address.
export function visitSiteUrl(siteSlug: string, defaultSlug: string | null): string {
  return siteSlug === defaultSlug ? '/' : publicPageUrl(siteSlug, '/');
}
