'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { BoltMark } from '../../components/logo';
import { api } from '../../lib/api';
import { getAccessToken } from '../../lib/auth-storage';

const DISMISS_KEY = 'neriva.adminPillDismissed';

const linkStyle: React.CSSProperties = {
  color: '#3d3d3d',
  textDecoration: 'none',
  fontWeight: 600,
};

const editButtonStyle: React.CSSProperties = {
  ...linkStyle,
  border: 'none',
  background: 'none',
  padding: 0,
  fontSize: 13,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

interface SiteRow {
  id: string;
  slug: string;
}

interface PageRow {
  id: string;
  path: string;
}

// Floating bridge back to the admin, shown on public pages only when the
// visitor has an access token in localStorage (spec 13). Invisible to
// anonymous visitors; an X hides it for the rest of the browser session.
// "Edit this page" resolves the current page through the admin API and
// opens it straight in the studio (edit-in-place, Liferay style).
export function AdminPill({ siteSlug, pagePath }: { siteSlug: string; pagePath: string }) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    try {
      if (getAccessToken() && sessionStorage.getItem(DISMISS_KEY) !== 'true') {
        setVisible(true);
      }
    } catch {
      // Storage unavailable: stay hidden.
    }
  }, []);

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      // Best effort; hiding for this render is still correct.
    }
    setVisible(false);
  }, []);

  const openEditor = useCallback(async () => {
    setResolving(true);
    try {
      const sites = await api.get<{ data: SiteRow[] }>('/sites?limit=100');
      const site = sites.data.find((candidate) => candidate.slug === siteSlug);
      if (site !== undefined) {
        const pages = await api.get<{ data: PageRow[] }>(`/sites/${site.id}/pages?limit=100`);
        const page = pages.data.find((candidate) => candidate.path === pagePath);
        if (page !== undefined) {
          router.push(`/admin/pages/${page.id}/design`);
          return;
        }
      }
    } catch {
      // Resolution failed (expired session, API error): fall through.
    }
    // Could not match this page in the admin: land on the pages list.
    router.push('/admin/pages?notfound=1');
  }, [router, siteSlug, pagePath]);

  if (!visible) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 12px',
        borderRadius: 999,
        background: 'rgba(255, 255, 255, 0.95)',
        border: '1px solid #e4e4e4',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.08)',
        fontSize: 13,
        fontFamily: 'var(--font-body), sans-serif',
      }}
    >
      <BoltMark size={15} />
      <Link href="/admin" style={linkStyle} prefetch>
        Admin
      </Link>
      <span aria-hidden="true" style={{ color: '#d5d5d5' }}>
        |
      </span>
      <button
        type="button"
        onClick={() => void openEditor()}
        disabled={resolving}
        style={{ ...editButtonStyle, cursor: resolving ? 'progress' : 'pointer' }}
      >
        {resolving ? 'Opening the editor...' : 'Edit this page'}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Hide admin shortcuts"
        style={{
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: '#9a9a9a',
          fontSize: 14,
          lineHeight: 1,
          padding: 2,
        }}
      >
        ×
      </button>
    </div>
  );
}
