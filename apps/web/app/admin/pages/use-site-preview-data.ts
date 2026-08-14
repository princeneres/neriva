import { useEffect, useState } from 'react';
import { apiUrl } from '../../../lib/api-url';
import type { NavPage } from '../../../lib/renderer/template';

// The site's public stylesheet and published page list, fetched once per
// siteSlug. Shared by the Studio canvas and the Preview mode: both need the
// same data to render header/footer blocks (dynamic nav, the theme toggle's
// CSS) the same way the live public page does.
export function useSitePreviewData(siteSlug: string | null): {
  css: string;
  sitePages: NavPage[];
} {
  const [css, setCss] = useState('');
  const [sitePages, setSitePages] = useState<NavPage[]>([]);

  useEffect(() => {
    if (siteSlug === null || siteSlug === '') {
      return;
    }
    let cancelled = false;
    fetch(apiUrl(`/public/sites/${siteSlug}/style.css`))
      .then((response) => (response.ok ? response.text() : ''))
      .then((text) => {
        if (!cancelled) {
          setCss(text);
        }
      })
      .catch(() => {
        // No public style endpoint yet: render with the block defaults.
      });
    return () => {
      cancelled = true;
    };
  }, [siteSlug]);

  useEffect(() => {
    if (siteSlug === null || siteSlug === '') {
      return;
    }
    let cancelled = false;
    fetch(apiUrl(`/public/sites/${siteSlug}/pages`))
      .then((response) => (response.ok ? response.json() : { data: [] }))
      .then((body: { data: { title: string; path: string }[] }) => {
        if (!cancelled) {
          setSitePages(body.data.map((page) => ({ title: page.title, path: page.path })));
        }
      })
      .catch(() => {
        // No public pages endpoint yet: header/footer nav keeps its placeholder.
      });
    return () => {
      cancelled = true;
    };
  }, [siteSlug]);

  return { css, sitePages };
}
