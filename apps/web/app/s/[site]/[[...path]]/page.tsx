import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchPublicPage, fetchSiteCss } from '../../../../lib/delivery';
import { RenderTree } from '../../../../lib/renderer/render-tree';

interface RouteParams {
  site: string;
  path?: string[];
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function pagePath(segments?: string[]): string {
  if (!segments || segments.length === 0) {
    return '/';
  }
  return `/${segments.map(safeDecode).join('/')}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { site, path } = await params;
  const data = await fetchPublicPage(site, pagePath(path));
  if (!data) {
    return { title: 'Page not found' };
  }
  return { title: `${data.page.title} | ${data.site.name}` };
}

export default async function PublicSitePage({ params }: { params: Promise<RouteParams> }) {
  const { site, path } = await params;
  const data = await fetchPublicPage(site, pagePath(path));
  if (!data) {
    notFound();
  }
  const css = await fetchSiteCss(site);
  return (
    <>
      <style>{css}</style>
      <main>
        <RenderTree tree={data.page.tree} blockInfo={data.blocks} />
      </main>
      <footer
        style={{
          textAlign: 'center',
          padding: '1.5rem 1rem',
          fontSize: '0.8rem',
          opacity: 0.6,
        }}
      >
        Built with{' '}
        <a href="#" style={{ color: 'inherit' }}>
          Neriva
        </a>
      </footer>
    </>
  );
}
