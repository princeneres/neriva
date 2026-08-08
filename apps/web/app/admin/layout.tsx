'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { ToastProvider } from '../../components/toast';
import { ApiError, logout, me, type PublicUser } from '../../lib/api';
import { clearTokens, getRefreshToken } from '../../lib/auth-storage';

const NAV_ITEMS = [
  { label: 'Sites', href: '/admin/sites' },
  { label: 'Pages', href: '/admin/pages' },
  { label: 'Content', href: '/admin/content' },
  { label: 'Objects', href: '/admin/objects' },
  { label: 'Style Book', href: '/admin/style-book' },
  { label: 'Users', href: '/admin/users' },
  { label: 'Settings', href: '/admin/settings' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    me()
      .then(({ data }) => setUser(data))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.problem.code === 'MUST_CHANGE_PASSWORD') {
          router.replace('/change-password');
          return;
        }
        clearTokens();
        router.replace('/login');
      });
  }, [router]);

  async function onLogout() {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await logout(refreshToken).catch(() => undefined);
    }
    clearTokens();
    router.replace('/login');
  }

  if (!user) {
    return null;
  }

  return (
    <ToastProvider>
      <div className="nv-shell">
        <aside className="nv-sidebar">
          <div className="nv-brand">
            Neriva<span>.</span>
          </div>
          <nav className="nv-nav">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="nv-main">
          <header className="nv-topbar">
            <span>{user.email}</span>
            <button type="button" onClick={onLogout}>
              Sign out
            </button>
          </header>
          <div className="nv-content">{children}</div>
        </div>
      </div>
    </ToastProvider>
  );
}
