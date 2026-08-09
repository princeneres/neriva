'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { AdminShell } from '../../components/admin-shell';
import { ApiError, me, type PublicUser } from '../../lib/api';
import { clearTokens } from '../../lib/auth-storage';

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

  if (!user) {
    return null;
  }

  return (
    <AdminShell user={user} storageNamespace="admin">
      {children}
    </AdminShell>
  );
}
