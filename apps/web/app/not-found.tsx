import type { Metadata } from 'next';
import { FallbackLink, FallbackScreen } from '../components/fallback-screen';

export const metadata: Metadata = {
  title: 'Page not found',
};

// Catches every address the app cannot resolve: the root catch-all calling
// notFound() for a path no site publishes, and any URL that matches no route
// at all. It renders inside the root layout, which is above AdminProviders,
// so there is no Mantine here: the styling comes from the Style Book tokens.
//
// Kept a server component on purpose. Marking it 'use client' (to branch the
// wording on usePathname) left the boundary suspended in the streamed HTML,
// so the page arrived empty until JavaScript ran.
export default function RootNotFound() {
  return (
    <FallbackScreen
      code="404"
      title="We could not find that page"
      description="The address you opened does not lead anywhere on this site. It may have been renamed, moved, or never published."
    >
      <FallbackLink href="/" variant="primary">
        Go to the home page
      </FallbackLink>
    </FallbackScreen>
  );
}
