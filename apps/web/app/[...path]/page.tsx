import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  fetchDefaultSite,
  fetchPublicPage,
  fetchSiteCss,
  type PublicPageData,
} from '../../lib/delivery';
import { isReservedPath } from '../../lib/reserved-paths';
import { pagePathFromSegments, PublishedPage } from '../s/published-page';

interface RouteParams {
  path: string[];
}

// Root catch-all: any non-reserved path serves the DEFAULT site's published
// page at that path, like /s/<slug>/<path> does (spec 13). Static routes
// (/login, /admin/*, /s/*, /change-password) win in Next's router; the
// isReservedPath guard is a defense in depth, not the routing mechanism.
async function resolvePage(segments: string[]): Promise<PublicPageData | null> {
  const pagePath = pagePathFromSegments(segments);
  if (isReservedPath(pagePath)) {
    return null;
  }
  const site = await fetchDefaultSite();
  if (!site) {
    return null;
  }
  return fetchPublicPage(site.slug, pagePath);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { path } = await params;
  const data = await resolvePage(path);
  if (!data) {
    return { title: 'Page not found' };
  }
  return { title: `${data.page.title} | ${data.site.name}` };
}

export default async function DefaultSitePage({ params }: { params: Promise<RouteParams> }) {
  const { path } = await params;
  const data = await resolvePage(path);
  if (!data) {
    notFound();
  }
  const css = await fetchSiteCss(data.site.slug);
  return <PublishedPage data={data} css={css} />;
}
