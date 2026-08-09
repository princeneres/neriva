# Spec 10: Public delivery API

Status: approved for implementation. Purpose: serve PUBLISHED content to anonymous visitors (the page rendering runtime and any headless consumer) without authentication. This is the read-only "delivery" side of the CMS; the authenticated API remains the management side.

## Endpoints (all @Public, no bearer token)

### GET /public/sites/:slug/page?path=<urlencoded path>

- `:slug` is the site slug (not id/erc). `path` defaults to `/`.
- Returns 404 problem+json when: site slug unknown, no page at that path, or the page is not PUBLISHED.
- Response `{ data }`:

```json
{
  "data": {
    "site": { "name": "Demo Site", "slug": "demo" },
    "page": {
      "title": "Welcome to Neriva",
      "path": "/",
      "tree": { "blocks": [] },
      "updatedAt": "..."
    },
    "blocks": {
      "hero": { "name": "Hero", "category": "content", "slots": [] }
    }
  }
}
```

- `blocks` maps every block ERC referenced anywhere in the tree to `{ name, category, slots }` (no propsSchema; the renderer does not validate). Only PUBLISHED blocks are included; a tree referencing a non-published block still renders (the map entry is simply present when the block row exists, whatever its status, since the page was validated at publish time).

### GET /public/sites/:slug/pages

- Lists PUBLISHED pages of the site: `{ data: [{ title, path, updatedAt }], meta: { cursor, limit } }` with the standard cursor pagination. Used for navigation menus and sitemaps.

### GET /public/sites/:slug/style.css

- `content-type: text/css`. Returns the CSS variables (`:root { --nv-<token>: <value>; }`) of the tenant's most recently published Style Book (highest `updatedAt` among PUBLISHED). Empty `:root {}` when none exists.

## Rules

- v1 is single-tenant per deploy: resolve the tenant the same way login does (default tenant by ERC). All queries remain tenant-scoped.
- No information leaks: DRAFT/ARCHIVED pages and non-existent paths are indistinguishable (both 404).
- Module: `apps/api/src/modules/delivery/` (controller + service), registered in AppModule. Uses direct tenant-scoped Drizzle queries (established service pattern).
- OpenAPI: tag `delivery`, documented like the other controllers, regenerated spec committed.
- Throttling: global limit already applies; no extra config.

## Tests

e2e (`test/delivery.e2e-spec.ts`): published demo page served without a token (the demo seed provides it); DRAFT page 404 (create one via the admin API in the test); unknown slug/path 404; blocks map contains the tree's ERCs; pages list only shows PUBLISHED; style.css content type and body shape; and the management API still requires auth (sanity: GET /pages/:id without token is 401).
