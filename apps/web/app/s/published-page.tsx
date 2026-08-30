import type { PublicPageData } from '../../lib/delivery';
import { RenderTree } from '../../lib/renderer/render-tree';
import { SiteChrome } from './site-chrome';
import { ThemeSync } from './theme-sync';

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

// Sticky-footer layout of the public page shell (spec 12, page shell): the
// root is a full-height column and <main> grows into the leftover space, so a
// page shorter than the viewport still has room under its content. The
// composed tree (master header, page blocks, master footer) renders inside
// that <main>, so the block that opts into the bottom by carrying
// nv-pin-bottom absorbs the leftover space; nv-pin-after-content opts out.
// :has() is what makes the pin reliable: RenderTree wraps a node with
// per-instance styles in an extra div, so the flex child of <main> is
// sometimes that wrapper and sometimes the block's own [data-nv-b] div, and
// matching on a descendant covers both. Long pages are unaffected: with no
// leftover space, margin-top: auto is zero.
const LAYOUT_CSS = [
  // The page ground is painted here, from the Style Book, and not by `body`:
  // globals.css binds body to Mantine's --mantine-color-body, which the site's
  // light/dark toggle cannot reach, so a dark page used to keep a white canvas
  // and render near-white text on it. color-background is preferred when the
  // Style Book defines it, with color-surface as the fallback so a token set
  // that predates it still darkens. Do not add a --nv-color-background default
  // to packages/ui/src/tokens.css: a var() fallback only applies to a property
  // that is undefined, so a global light default there would shadow the Style
  // Book's dark color-surface and pin the ground white again.
  '.nv-site-root { display: flex; flex-direction: column; min-height: 100vh;' +
    ' background: var(--nv-color-background, var(--nv-color-surface, #ffffff));' +
    ' color: var(--nv-color-text, #1a1917); }',
  '.nv-site-root > main { display: flex; flex-direction: column; flex: 1 1 auto; }',
  '.nv-site-root > main > *:has(.nv-pin-bottom):not(:has(.nv-pin-after-content)) { margin-top: auto; }',
].join('\n');

// Shared rendering of a published page, used by /s/<slug>/... and by the
// default-site root routes (spec 13) so both stay pixel-identical.
export function PublishedPage({ data, css }: { data: PublicPageData; css: string }) {
  return (
    <SiteChrome siteSlug={data.site.slug} pagePath={data.page.path}>
      <style>{LAYOUT_CSS}</style>
      <style>{css}</style>
      {/* nv-site-root is the ancestor a header block's light/dark toggle
          reaches with a :has() selector (spec 06 dark-mode amendment); it
          must wrap every block, including the footer. The site footer is the
          page's own nv-footer block, so the runtime adds no footer of its
          own. */}
      <ThemeSync />
      <div className="nv-site-root">
        <main>
          <RenderTree
            tree={data.page.tree}
            blockInfo={data.blocks}
            sitePages={data.site.pages}
            siteSlug={data.site.slug}
          />
        </main>
      </div>
    </SiteChrome>
  );
}
