'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { AdminShell } from '../../components/admin-shell';
import { ApiError, me, type PublicUser } from '../../lib/api';
import { getAccessToken } from '../../lib/auth-storage';

// Wraps a published page with the real admin navigation, collapsed to an
// icon rail, when the visitor is a signed-in admin (spec: the lateral menu
// should be reachable from the site itself, not a separate floating pill).
// Anonymous visitors pay zero cost: no token means no fetch, no wrapper.
export function SiteChrome({
  siteSlug,
  pagePath,
  children,
}: {
  siteSlug: string;
  pagePath: string;
  children: ReactNode;
}) {
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      return;
    }
    me()
      .then(({ data }) => setUser(data))
      .catch((err: unknown) => {
        // A pending forced password change or an expired session: stay out
        // of the visitor's way rather than redirecting off the page they
        // were reading.
        if (!(err instanceof ApiError)) {
          return;
        }
      });
  }, []);

  if (!user) {
    return <>{children}</>;
  }

  return (
    <AdminShell
      user={user}
      editTarget={{ siteSlug, pagePath }}
      storageNamespace="site"
      paintBackground={false}
    >
      {children}
    </AdminShell>
  );
}
