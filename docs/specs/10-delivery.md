# Spec 10: Public delivery API

Status: approved for implementation. Purpose: serve PUBLISHED content to anonymous visitors (the page rendering runtime and any headless consumer) without authentication. This is the read-only "delivery" side of the CMS; the authenticated API remains the management side.

## Endpoints (all @Public, no bearer token)

### GET /public/sites/:slug/page?path=<urlencoded path>

- `:slug` is the site slug (not id/erc). `path` defaults to `/`.
- Returns 404 problem+json when: site slug unknown, no page at that path, or the page is not PUBLISHED.
- `page.tree` is the COMPOSED tree (spec 14): the resolved master template's tree with the page's own blocks spliced into the reserved drop zone, or the page's own tree unchanged when no master resolves. Resolution order: the page's own `masterPageTemplateId` -> the tenant's `isDefault = true` MASTER template -> the single MASTER template with the lowest `createdAt` -> no master.
- Response `{ data }`, here for a page whose site relies on the seeded default master (`master-default`):

```json
{
  "data": {
    "site": {
      "name": "Demo Site",
      "slug": "demo",
      "pages": [{ "title": "Welcome to Neriva", "path": "/" }]
    },
    "page": {
      "title": "Welcome to Neriva",
      "path": "/",
      "tree": {
        "blocks": [
          {
            "block": "nv-header",
            "props": { "siteName": "Your Site", "tagline": "Built with Neriva" }
          },
          { "block": "hero", "props": { "heading": "Build pages from blocks" } },
          {
            "block": "nv-footer",
            "props": { "text": "<p>© 2026 Your Site. All rights reserved.</p>" }
          }
        ]
      },
      "updatedAt": "..."
    },
    "blocks": {
      "nv-header": {
        "name": "Header",
        "category": "layout",
        "slots": [],
        "html": "<header class=\"nv-header\">...<nav data-nv-nav=\"pages\">...</nav>...</header>",
        "css": ".nv-header { background: var(--nv-color-surface, #fff); }"
      },
      "hero": {
        "name": "Hero",
        "category": "content",
        "slots": [],
        "html": "<section class=\"hero\"><h1 data-nv-text=\"heading\"></h1></section>",
        "css": ".hero { background: var(--nv-color-surface, #faf9f7); }"
      },
      "nv-footer": {
        "name": "Footer",
        "category": "layout",
        "slots": [],
        "html": "<footer class=\"nv-footer\">...<nav data-nv-nav=\"pages\">...</nav>...</footer>",
        "css": ".nv-footer { background: var(--nv-color-surface-alt, #f1efec); }"
      }
    }
  }
}
```

- `blocks` maps every block ERC referenced anywhere in the COMPOSED tree, the page's own refs unioned with the resolved master's, to `{ name, category, slots, html, css }` (no propsSchema; the renderer does not validate). `html` and `css` are the block's template (spec 12), null for registry-rendered blocks. Only PUBLISHED blocks are included; a tree referencing a non-published block still renders (the map entry is simply present when the block row exists, whatever its status, since the page was validated at publish time).
- `site.pages` (amendment, spec 12 header/footer nav): the site's own PUBLISHED pages (`{ title, path }` only), ordered by path and capped at 50, feeding every `data-nv-nav="pages"` binding on the composed page (typically the master's `nv-header`/`nv-footer`).

### GET /public/sites/:slug/pages

- Lists PUBLISHED pages of the site: `{ data: [{ title, path, updatedAt }], meta: { cursor, limit } }` with the standard cursor pagination. Used for navigation menus and sitemaps.

### GET /public/sites/:slug/content-entries?contentType=&q=&limit=&cursor=

Read-only listing of the site's PUBLISHED content entries, newest first, so a website can render a blog index (post cards plus inline expansion) with search and pagination without a token.

Query parameters, all optional:

- `contentType`: content type reference, UUID or `erc:<externalReferenceCode>`.
- `q`: search term, max 200 characters.
- `limit`, `cursor`: the standard cursor pagination (default 20, max 100).

Response `{ data, meta }`:

```json
{
  "data": [
    {
      "id": "0195d9c6-6f1a-7c3e-9b41-2f8d5a7c1e04",
      "externalReferenceCode": "article-objects-and-media",
      "title": "Objects and Media",
      "contentType": "article",
      "values": {
        "summary": "Two more building blocks for your data: custom Objects and a Media library.",
        "body": "Objects let you define your own data tables without writing a migration.",
        "publishedOn": "2026-01-19"
      },
      "updatedAt": "2026-01-19T09:12:44.318Z"
    },
    {
      "id": "0195d9c6-1a2b-7f55-8e10-9c3d7b6a2f81",
      "externalReferenceCode": "article-blocks-explained",
      "title": "Blocks explained",
      "contentType": "article",
      "values": {
        "summary": "How pages are composed from typed, schema-validated blocks.",
        "body": "A block declares a JSON Schema for its props and a list of named slots.",
        "publishedOn": "2026-01-12"
      },
      "updatedAt": "2026-01-12T09:12:44.318Z"
    }
  ],
  "meta": { "cursor": "eyJpZCI6IjAxOTVkOWM2LTFhMmItN2Y1NS04ZTEwLTljM2Q3YjZhMmY4MSJ9", "limit": 2 }
}
```

Each item carries exactly what a post card and an inline post view need: `{ id, externalReferenceCode, title, contentType, values, updatedAt }`. `contentType` is the content type's ERC, the stable handle a website templates against; `values` is the full field payload, so no follow-up request is needed to expand a post. The management envelope (`tenantId`, `status`, `siteId`, `contentTypeId`, `customFields`, `createdBy`, `createdAt`) is not exposed.

Decisions:

- **Only PUBLISHED entries.** DRAFT and ARCHIVED entries never appear, like every other delivery endpoint.
- **Site-scoped only.** An entry is listed when its `siteId` equals the resolved site's id. Tenant-wide entries (`siteId IS NULL`, spec 04) are NOT included: a site's public listing must be predictable and must not surface content that belongs to no site. A tenant-wide entry that should appear on a site is attached to that site through the management API.
- **Unknown site slug: 404** problem+json, like the sibling endpoints.
- **Unknown `contentType`: empty list, not 404.** The endpoint never reveals whether a given content type exists. A syntactically invalid reference (neither a UUID nor `erc:<code>`) is still a 400, the same validation error the whole API returns for a malformed reference; that leaks nothing about existence.
- **Ordering: newest first.** Ids are UUIDv7 and therefore time-ordered, so the listing orders by `id DESC` with an `id < cursor` keyset. This is the only delivery listing that runs descending; the ascending helpers in `common/pagination.ts` are direction agnostic (they encode and decode the id cursor), so the direction lives in the query, as it does for every other listing.
- **Search `q` is a naive substring match, not full-text.** Case-insensitive `ILIKE '%term%'` against the entry `title` OR the whole `values` payload cast to text. Consequences, accepted for v1: it can match on JSON field keys as well as on field values; it can match markup inside richtext values; it is not tokenized, stemmed, ranked or relevance-ordered (results keep the newest-first order); and `\`, `%` and `_` in the term are escaped so they match literally. A ranked full-text search (tsvector, per-field targeting) is a later feature.

There is deliberately no public single-entry endpoint and no public write endpoint: the list already returns full `values`, and delivery stays read-only.

### GET /public/sites/:slug/style.css

- `content-type: text/css`. Returns two blocks for the tenant's most recently published Style Book (highest `updatedAt` among PUBLISHED): the light tokens on `:root { --nv-<token>: <value>; }`, then the dark tokens on `.nv-site-root:has(#nv-theme-toggle:checked) { --nv-<token>: <value>; }` (spec 06 dark-mode amendment). Empty `:root {}` with no dark block when no Style Book exists.

## Rules

- v1 is single-tenant per deploy: resolve the tenant the same way login does (default tenant by ERC). All queries remain tenant-scoped.
- No information leaks: DRAFT/ARCHIVED pages and non-existent paths are indistinguishable (both 404).
- Module: `apps/api/src/modules/delivery/` (controller + service), registered in AppModule. Uses direct tenant-scoped Drizzle queries (established service pattern).
- OpenAPI: tag `delivery`, documented like the other controllers, regenerated spec committed.
- Throttling: global limit already applies; no extra config.

## Tests

e2e (`test/delivery.e2e-spec.ts`): published demo page served without a token (the demo seed provides it); DRAFT page 404 (create one via the admin API in the test); unknown slug/path 404; blocks map contains the tree's ERCs including the master's `nv-header`/`nv-footer`; `site.pages` contains the demo page; pages list only shows PUBLISHED; style.css content type and body shape (including the dark block); and the management API still requires auth (sanity: GET /pages/:id without token is 401).

Content entry listing (same suite, fixtures created through the authenticated API: two content types, three published posts in the demo site, one DRAFT post, one tenant-wide published post, one entry of the second type): a PUBLISHED site-scoped entry is returned anonymously with its `values` intact and only the six delivery fields; the DRAFT entry and the tenant-wide entry are absent; `contentType` narrows the list to one type and an unknown reference (both `erc:` and UUID forms) returns an empty list with a null cursor instead of a 404; `q` matches on the title and on a value inside `values`, case-insensitively, and excludes non-matching entries; `limit=2` walks the three posts across two pages, newest first, with strictly descending ids and no duplicates or gaps; and an unknown site slug is 404 problem+json.
