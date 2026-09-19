import type { Metadata } from 'next';
import { BoltMark } from '../components/logo';
import { fetchDefaultSite, fetchPublicPage, fetchSiteCss } from '../lib/delivery';
import { PublishedPage } from './s/published-page';

export async function generateMetadata(): Promise<Metadata> {
  const site = await fetchDefaultSite();
  if (!site) {
    return { title: 'Neriva' };
  }
  const data = await fetchPublicPage(site.slug, '/');
  if (!data) {
    return { title: site.name };
  }
  return { title: `${data.page.title} | ${data.site.name}` };
}

// Fresh install, no default site or no published home yet: a friendly
// landing instead of a 404, pointing at the admin (spec 13). The CTA goes
// straight to /admin/sites rather than /admin: /admin is now a bare
// redirect back to /, so an authenticated user with zero sites would
// otherwise bounce right back to this same screen.
function WelcomeScreen() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '2rem',
        textAlign: 'center',
        fontFamily: 'var(--font-body), sans-serif',
      }}
    >
      <BoltMark size={56} />
      <h1 style={{ fontSize: '1.6rem', letterSpacing: '-0.02em', margin: 0 }}>
        Neriva is running.
      </h1>
      <p style={{ margin: 0, opacity: 0.65, maxWidth: 420 }}>
        There is no published site here yet. Head to the admin to create your first pages.
      </p>
      <a
        href="/admin/sites"
        style={{
          marginTop: '0.5rem',
          padding: '0.6rem 1.4rem',
          borderRadius: 8,
          background: '#cc3d47',
          color: '#fff',
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Sign in to build your site
      </a>
    </main>
  );
}

// The root serves the DEFAULT site's home, exactly like /s/<slug> does
// (spec 13). The old redirect to /admin or /login is gone on purpose:
// the public site is the front door.
export default async function RootPage() {
  const site = await fetchDefaultSite();
  const data = site ? await fetchPublicPage(site.slug, '/') : null;
  if (!site || !data) {
    return <WelcomeScreen />;
  }
  const css = await fetchSiteCss(site.slug);
  return <PublishedPage data={data} css={css} siteBasePath="" />;
}
