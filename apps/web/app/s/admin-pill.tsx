'use client';

import { useCallback, useEffect, useState } from 'react';
import { BoltMark } from '../../components/logo';
import { getAccessToken } from '../../lib/auth-storage';

const DISMISS_KEY = 'neriva.adminPillDismissed';

const linkStyle: React.CSSProperties = {
  color: '#3d3d3d',
  textDecoration: 'none',
  fontWeight: 600,
};

// Floating bridge back to the admin, shown on public pages only when the
// visitor has an access token in localStorage (spec 13). Invisible to
// anonymous visitors; an X hides it for the rest of the browser session.
export function AdminPill() {
  const [visible, setVisible] = useState(false);

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
      <a href="/admin" style={linkStyle}>
        Admin
      </a>
      <span aria-hidden="true" style={{ color: '#d5d5d5' }}>
        |
      </span>
      {/* Page-level studio resolution is a later step; the pages list is the
          reliable target for every public page (spec 13). */}
      <a href="/admin/pages" style={linkStyle}>
        Edit this page
      </a>
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
