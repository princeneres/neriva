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

export interface SiteSummary {
  id: string;
  name: string;
  slug: string;
}

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

export function SiteProvider({ children }: { children: ReactNode }) {
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [defaultSlug, setDefaultSlug] = useState<string | null>(null);

  useEffect(() => {
    // Anonymous delivery endpoint, fetched once; the Visit link falls back
    // to /s/<slug> while (or if) this is unknown.
    fetch(apiUrl('/public/site'))
      .then(async (res) => {
        if (!res.ok) {
          return;
        }
        const body = (await res.json()) as { data: { slug: string } };
        setDefaultSlug(body.data.slug);
      })
      .catch(() => undefined);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const page = await api.get<{ data: SiteSummary[] }>('/sites?limit=100');
      setSites(page.data);
      const stored = localStorage.getItem(STORAGE_KEY);
      const valid = page.data.find((s) => s.id === stored);
      // Default to the first site so screens are usable without a manual pick.
      setCurrentId(valid?.id ?? page.data[0]?.id ?? null);
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
