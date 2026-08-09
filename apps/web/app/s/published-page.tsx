import type { PublicPageData } from '../../lib/delivery';
import { RenderTree } from '../../lib/renderer/render-tree';
import { AdminPill } from './admin-pill';

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

// Route segments to a delivery page path: [] -> '/', ['a','b'] -> '/a/b'.
export function pagePathFromSegments(segments?: string[]): string {
  if (!segments || segments.length === 0) {
    return '/';
  }
  return `/${segments.map(safeDecode).join('/')}`;
}

// Shared rendering of a published page, used by /s/<slug>/... and by the
// default-site root routes (spec 13) so both stay pixel-identical.
export function PublishedPage({ data, css }: { data: PublicPageData; css: string }) {
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
      <AdminPill siteSlug={data.site.slug} pagePath={data.page.path} />
    </>
  );
}
