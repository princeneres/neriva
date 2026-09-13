'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../../api-url';
import type { BlockRenderProps } from '../registry';
import {
  buildPostListPath,
  entryFieldText,
  formatPostDate,
  hasPreviousPage,
  INITIAL_PAGER,
  nextPage,
  previousPage,
  resolveFieldKeys,
  resolvePageSize,
  type CursorPager,
  type DeliveredEntry,
} from './post-list-data';

const CSS = `
.nv-post-list { font-family: var(--nv-font-body, system-ui); color: var(--nv-color-text, #1a1917); max-width: 72rem; margin: 0 auto; padding: var(--nv-space-md, 1rem); }
.nv-post-list-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--nv-space-md, 1rem); margin-bottom: var(--nv-space-lg, 2rem); }
.nv-post-list-title { margin: 0; font-size: 1.75rem; letter-spacing: -0.01em; }
.nv-post-list-search { flex: 0 1 18rem; display: flex; }
.nv-post-list-search input { width: 100%; box-sizing: border-box; padding: 0.55rem 0.85rem; font: inherit; font-size: 0.9375rem; color: inherit; background: var(--nv-color-surface, #fff); border: 1px solid var(--nv-color-border, rgba(0, 0, 0, 0.14)); border-radius: var(--nv-radius-md, 8px); }
.nv-post-list-search input:focus-visible { outline: 2px solid var(--nv-color-primary, #cc3d47); outline-offset: 1px; }
.nv-post-list-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr)); gap: var(--nv-space-lg, 2rem); }
.nv-post-card { display: flex; flex-direction: column; overflow: hidden; background: var(--nv-color-surface, #fff); border: 1px solid var(--nv-color-border, rgba(0, 0, 0, 0.1)); border-radius: var(--nv-radius-md, 8px); }
.nv-post-card-image { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
.nv-post-card-body { display: flex; flex-direction: column; gap: 0.4rem; padding: var(--nv-space-md, 1rem); flex: 1; }
.nv-post-card-date { font-size: 0.75rem; letter-spacing: 0.04em; text-transform: uppercase; opacity: 0.55; }
.nv-post-card-title { margin: 0; font-size: 1.125rem; line-height: 1.3; }
.nv-post-card-summary { margin: 0; font-size: 0.9375rem; line-height: 1.55; opacity: 0.8; }
.nv-post-card-full { margin: 0; font-size: 0.9375rem; line-height: 1.6; white-space: pre-wrap; }
.nv-post-card-more { align-self: flex-start; margin-top: auto; padding: 0; font: inherit; font-size: 0.875rem; font-weight: 600; color: var(--nv-color-primary, #cc3d47); background: none; border: none; cursor: pointer; }
.nv-post-card-more:hover { text-decoration: underline; }
.nv-post-list-pager { display: flex; justify-content: center; gap: var(--nv-space-sm, 0.5rem); margin-top: var(--nv-space-lg, 2rem); }
.nv-post-list-pager button { padding: 0.5rem 1rem; font: inherit; font-size: 0.875rem; font-weight: 600; color: inherit; background: var(--nv-color-surface, #fff); border: 1px solid var(--nv-color-border, rgba(0, 0, 0, 0.14)); border-radius: var(--nv-radius-md, 8px); cursor: pointer; }
.nv-post-list-pager button:disabled { opacity: 0.4; cursor: default; }
.nv-post-list-note { margin: 0; padding: var(--nv-space-lg, 2rem) 0; text-align: center; font-size: 0.9375rem; opacity: 0.7; }
.nv-post-list-skeleton { height: 12rem; border-radius: var(--nv-radius-md, 8px); background: var(--nv-color-surface-alt, #f1efec); }
`;

interface DeliveryList {
  data: DeliveredEntry[];
  meta: { cursor: string | null; limit: number };
}

// Lists published content entries from the public delivery API, with search
// and cursor pagination (spec 10). Client rendered on purpose: search and
// paging are interactive. The trade-off is that the posts are not in the
// server HTML, so crawlers do not see them (documented in spec 12).
export function PostList({ props, siteSlug }: BlockRenderProps) {
  const heading = typeof props.heading === 'string' ? props.heading.trim() : '';
  const contentType = typeof props.contentType === 'string' ? props.contentType.trim() : '';
  const showSearch = props.showSearch !== false;
  const pageSize = resolvePageSize(props.pageSize);
  const fields = useMemo(() => resolveFieldKeys(props), [props]);
  const emptyText =
    typeof props.emptyText === 'string' && props.emptyText.trim() !== ''
      ? props.emptyText.trim()
      : 'No posts yet.';

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [pager, setPager] = useState<CursorPager>(INITIAL_PAGER);
  const [entries, setEntries] = useState<DeliveredEntry[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // A new search starts a new result set, so the visited cursors no longer
  // describe it.
  useEffect(() => {
    setPager(INITIAL_PAGER);
  }, [debounced]);

  const ready = siteSlug !== undefined && contentType !== '';

  useEffect(() => {
    if (!ready || siteSlug === undefined) {
      return;
    }
    let active = true;
    setFailed(false);
    const path = buildPostListPath({
      siteSlug,
      contentType,
      search: debounced,
      pageSize,
      cursor: pager.cursor,
    });
    fetch(apiUrl(path))
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Delivery request failed with ${response.status}`);
        }
        return (await response.json()) as DeliveryList;
      })
      .then((body) => {
        if (!active) {
          return;
        }
        setEntries(body.data);
        setNextCursor(body.meta.cursor);
        setExpanded(null);
      })
      .catch(() => {
        if (active) {
          setFailed(true);
          setEntries([]);
          setNextCursor(null);
        }
      });
    return () => {
      active = false;
    };
  }, [ready, siteSlug, contentType, debounced, pageSize, pager.cursor]);

  return (
    <section className="nv-post-list">
      <style>{CSS}</style>
      <div className="nv-post-list-head">
        {heading !== '' ? <h2 className="nv-post-list-title">{heading}</h2> : <span />}
        {showSearch && ready ? (
          <div className="nv-post-list-search">
            <input
              type="search"
              value={search}
              placeholder="Search posts"
              aria-label="Search posts"
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
          </div>
        ) : null}
      </div>

      {!ready ? (
        <p className="nv-post-list-note">
          This block lists published content entries once a content type is chosen in its settings.
        </p>
      ) : failed ? (
        <p className="nv-post-list-note">The posts could not be loaded right now.</p>
      ) : entries === null ? (
        <div className="nv-post-list-grid" aria-busy="true">
          {Array.from({ length: Math.min(pageSize, 3) }, (_unused, index) => (
            <div key={index} className="nv-post-list-skeleton" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="nv-post-list-note">{debounced === '' ? emptyText : 'No post matches.'}</p>
      ) : (
        <div className="nv-post-list-grid">
          {entries.map((entry) => {
            const image = entryFieldText(entry, fields.image);
            const summary = entryFieldText(entry, fields.summary);
            const body = entryFieldText(entry, fields.body);
            const date = formatPostDate(entryFieldText(entry, fields.date));
            const open = expanded === entry.id;
            return (
              <article key={entry.id} className="nv-post-card">
                {image !== null ? (
                  // Arbitrary CMS-authored URLs: next/image would need a
                  // remote-pattern entry per deployment.
                  <img
                    className="nv-post-card-image"
                    src={image}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                ) : null}
                <div className="nv-post-card-body">
                  {date !== null ? <span className="nv-post-card-date">{date}</span> : null}
                  <h3 className="nv-post-card-title">{entry.title}</h3>
                  {open && body !== null ? (
                    <p className="nv-post-card-full">{body}</p>
                  ) : summary !== null ? (
                    <p className="nv-post-card-summary">{summary}</p>
                  ) : null}
                  {body !== null ? (
                    <button
                      type="button"
                      className="nv-post-card-more"
                      aria-expanded={open}
                      onClick={() => setExpanded(open ? null : entry.id)}
                    >
                      {open ? 'Show less' : 'Read more'}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {ready && entries !== null && (hasPreviousPage(pager) || nextCursor !== null) ? (
        <div className="nv-post-list-pager">
          <button
            type="button"
            disabled={!hasPreviousPage(pager)}
            onClick={() => setPager(previousPage(pager))}
          >
            Previous
          </button>
          <button
            type="button"
            disabled={nextCursor === null}
            onClick={() => setPager(nextPage(pager, nextCursor))}
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}
