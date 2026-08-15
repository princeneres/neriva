'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { AdminShell } from '../../components/admin-shell';
import { ApiError, me, type PublicUser } from '../../lib/api';
import { clearTokens } from '../../lib/auth-storage';
import { readSessionUser, saveSessionUser } from '../../lib/session-user';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    // Paint the shell from the last known profile, then confirm it. Without
    // this the whole admin is a blank screen for the length of one round trip
    // on every reload. Nothing sensitive rides on the cached copy: every
    // request underneath still carries the token, and a rejected /auth/me
    // clears the session below.
    setUser(readSessionUser());

    me()
      .then(({ data }) => {
        saveSessionUser(data);
        setUser(data);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.problem.code === 'MUST_CHANGE_PASSWORD') {
          router.replace('/change-password');
          return;
        }
        setUser(null);
        clearTokens();
        router.replace('/login');
      });
  }, [router]);

  if (!user) {
    return null;
  }

  return (
    <AdminShell user={user} storageNamespace="admin">
      {children}
    </AdminShell>
  );
}
