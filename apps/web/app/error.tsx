'use client';

import { useEffect } from 'react';
import { FallbackButton, FallbackLink, FallbackScreen } from '../components/fallback-screen';

// Error boundary for everything outside /admin: the published pages and the
// standalone auth screens. It replaces the page but not the root layout, so
// Mantine is still unavailable here.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The only place the raw failure is allowed to surface. Visitors get the
    // digest, which is the same id the server logged the stack under.
    console.error('[neriva] unhandled error', error);
  }, [error]);

  return (
    <FallbackScreen
      title="Something went wrong"
      description="This page could not be loaded. It is not something you did wrong, and trying again often works."
      reference={error.digest}
    >
      <FallbackButton onClick={reset} variant="primary">
        Try again
      </FallbackButton>
      <FallbackLink href="/">Go to the home page</FallbackLink>
    </FallbackScreen>
  );
}
