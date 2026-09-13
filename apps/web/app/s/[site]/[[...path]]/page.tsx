import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchPublicPage, fetchSiteCss } from '../../../../lib/delivery';
import { pagePathFromSegments, PublishedPage } from '../../published-page';

interface RouteParams {
  site: string;
  path?: string[];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { site, path } = await params;
  const data = await fetchPublicPage(site, pagePathFromSegments(path));
  if (!data) {
    return { title: 'Page not found' };
  }
  return { title: `${data.page.title} | ${data.site.name}` };
}

export default async function PublicSitePage({ params }: { params: Promise<RouteParams> }) {
  const { site, path } = await params;
  const data = await fetchPublicPage(site, pagePathFromSegments(path));
  if (!data) {
    notFound();
  }
  const css = await fetchSiteCss(site);
  return <PublishedPage data={data} css={css} siteBasePath={`/s/${encodeURIComponent(site)}`} />;
}
