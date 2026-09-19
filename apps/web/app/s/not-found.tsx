import { FallbackLink, FallbackScreen } from '../../components/fallback-screen';

// Not-found boundary for /s/<slug>/<path>. Same screen as the root one, with
// wording that fits a visitor who followed a link into a specific site.
export default function PublicNotFound() {
  return (
    <FallbackScreen
      code="404"
      title="We could not find that page"
      description="The link you followed does not lead anywhere on this site. It may have been renamed, moved, or never published."
    >
      <FallbackLink href="/" variant="primary">
        Go to the home page
      </FallbackLink>
    </FallbackScreen>
  );
}
