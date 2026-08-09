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
  select: (id: string | null) => void;
  refresh: () => Promise<void>;
}

const SiteContext = createContext<SiteContextValue | null>(null);
const STORAGE_KEY = 'neriva.currentSiteId';

export function SiteProvider({ children }: { children: ReactNode }) {
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentId, setCurrentId] = useState<string | null>(null);

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
      select,
      refresh,
    }),
    [sites, loading, currentId, select, refresh],
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
