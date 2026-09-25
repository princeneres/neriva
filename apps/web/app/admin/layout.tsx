'use client';

import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { AdminProviders } from '../../components/admin-providers';
import { AdminShell } from '../../components/admin-shell';
import { ApiError, me, type PublicUser } from '../../lib/api';
import { clearTokens, getAccessToken } from '../../lib/auth-storage';
import { readSessionUser, saveSessionUser } from '../../lib/session-user';

// Who is signed in, as far as this tab knows:
//   unknown   first render, before the client has looked at storage
//   checking  a token exists, the screen is mounting, /auth/me is in flight
//   confirmed /auth/me answered and named the user
//   rejected  no token, or the API refused this one; a redirect is under way
type SessionStatus = 'unknown' | 'checking' | 'confirmed' | 'rejected';

interface SessionState {
  status: SessionStatus;
  user: PublicUser | null;
}

// Stand-in profile for the frame between mounting the admin and /auth/me
// answering on a tab with no cached profile. It names nobody: the shell draws a
// placeholder for the account row until the server says who is signed in.
const UNKNOWN_PROFILE: PublicUser = {
  id: '',
  externalReferenceCode: '',
  tenantId: '',
  createdAt: '',
  updatedAt: '',
  createdBy: null,
  email: '',
  displayName: '',
  mustChangePassword: false,
  customFields: {},
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionState>({ status: 'unknown', user: null });

  useEffect(() => {
    // No credential at all: the admin never mounts and the API is never asked.
    // This is the ordinary signed-out case, and it stays fully blocking.
    if (getAccessToken() === null) {
      setSession({ status: 'rejected', user: null });
      router.replace('/login');
      return;
    }

    // A token exists, so mount the shell and the screen now and let /auth/me
    // confirm alongside them. Holding the children back until the profile
    // arrived made the screen's own request wait a full round trip for a check
    // it does not depend on: every request underneath carries the token anyway,
    // and a refused /auth/me tears the whole thing down below.
    setSession({ status: 'checking', user: readSessionUser() });

    me()
      .then(({ data }) => {
        saveSessionUser(data);
        setSession({ status: 'confirmed', user: data });
      })
      .catch((error: unknown) => {
        // Unmount the admin before redirecting, so no screen keeps painting
        // rows behind the transition.
        setSession({ status: 'rejected', user: null });
        if (error instanceof ApiError && error.problem.code === 'MUST_CHANGE_PASSWORD') {
          // The session is valid, it is just not allowed anywhere else yet.
          router.replace('/change-password');
          return;
        }
        clearTokens();
        router.replace('/login');
      });
  }, [router]);

  if (session.status === 'unknown' || session.status === 'rejected') {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{ padding: '2rem', color: 'var(--mantine-color-dimmed)' }}
      >
        Loading admin…
      </div>
    );
  }

  return (
    <AdminProviders>
      <AdminShell
        user={session.user ?? UNKNOWN_PROFILE}
        profilePending={session.user === null}
        storageNamespace="admin"
      >
        {children}
      </AdminShell>
    </AdminProviders>
  );
}
