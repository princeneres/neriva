import type { RenderTreeInput } from './renderer/render-tree';

// Server-side fetchers for the public delivery API (spec 10). The internal
// URL wins on the server so the container can reach the API directly.
function deliveryBase(): string {
  return process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

export interface DeliverySite {
  name: string;
  slug: string;
}

export interface DeliveryNavPage {
  title: string;
  path: string;
}

export interface DeliveryPage {
  title: string;
  path: string;
  tree: RenderTreeInput;
  updatedAt: string;
}

export interface DeliveryBlockInfo {
  name: string;
  category: string | null;
  slots: string[];
  html: string | null;
  css: string | null;
  js: string | null;
}

export interface PublicPageData {
  // pages: the site's own published pages, for a header/footer block's
  // data-nv-nav to render real navigation.
  site: DeliverySite & { pages: DeliveryNavPage[] };
  page: DeliveryPage;
  blocks: Record<string, DeliveryBlockInfo>;
}

// Default site the root URL serves (spec 13); null when none exists yet.
export async function fetchDefaultSite(): Promise<DeliverySite | null> {
  const url = `${deliveryBase()}/public/site`;
  try {
    const response = await fetch(url, { next: { revalidate: 60 } });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { data: DeliverySite };
    return body.data;
  } catch {
    // API unreachable (e.g. build time): treat as not configured.
    return null;
  }
}

export async function fetchPublicPage(
  siteSlug: string,
  path: string,
): Promise<PublicPageData | null> {
  const url = `${deliveryBase()}/public/sites/${encodeURIComponent(siteSlug)}/page?path=${encodeURIComponent(path)}`;
  try {
    const response = await fetch(url, { next: { revalidate: 60 } });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { data: PublicPageData };
    return body.data;
  } catch {
    // API unreachable (e.g. build time): treat as not found.
    return null;
  }
}

export async function fetchSiteCss(siteSlug: string): Promise<string> {
  const url = `${deliveryBase()}/public/sites/${encodeURIComponent(siteSlug)}/style.css`;
  try {
    const response = await fetch(url, { next: { revalidate: 60 } });
    if (!response.ok) {
      return '';
    }
    return await response.text();
  } catch {
    return '';
  }
}
