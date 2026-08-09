# Spec 10: Public delivery API

Status: approved for implementation. Purpose: serve PUBLISHED content to anonymous visitors (the page rendering runtime and any headless consumer) without authentication. This is the read-only "delivery" side of the CMS; the authenticated API remains the management side.

## Endpoints (all @Public, no bearer token)

### GET /public/sites/:slug/page?path=<urlencoded path>

- `:slug` is the site slug (not id/erc). `path` defaults to `/`.
- Returns 404 problem+json when: site slug unknown, no page at that path, or the page is not PUBLISHED.
- `page.tree` is the COMPOSED tree (spec 14): the resolved master template's tree with the page's own blocks spliced into the reserved drop zone, or the page's own tree unchanged when no master resolves. Resolution order: the page's own `masterPageTemplateId` -> the tenant setting `page.default-master-template` -> the single MASTER template with the lowest `createdAt` -> no master.
- Response `{ data }`, here for a page whose site relies on the seeded default master (`master-default`):

```json
{
  "data": {
    "site": { "name": "Demo Site", "slug": "demo" },
    "page": {
      "title": "Welcome to Neriva",
      "path": "/",
      "tree": {
        "blocks": [
          {
            "block": "nv-container",
            "slots": {
              "content": [
                { "block": "nv-heading", "props": { "text": "Your Site" } },
                { "block": "nv-paragraph", "props": { "text": "A site built with Neriva CMS" } }
              ]
            }
          },
          { "block": "hero", "props": { "heading": "Build pages from blocks" } },
          {
            "block": "nv-container",
            "slots": {
              "content": [
                { "block": "nv-paragraph", "props": { "text": "© 2026 · Built with Neriva" } }
              ]
            }
          }
        ]
      },
      "updatedAt": "..."
    },
    "blocks": {
      "nv-container": {
        "name": "Container",
        "category": "layout",
        "slots": [{ "name": "content" }],
        "html": "<section class=\"nv-container\" style=\"background: {{background}}\">...</section>",
        "css": ".nv-container { padding: var(--nv-space-lg, 2rem) var(--nv-space-md, 1rem); }"
      },
      "nv-heading": {
        "name": "Heading",
        "category": "basic",
        "slots": [],
        "html": "<h2 class=\"nv-heading nv-heading-{{level}}\" data-nv-text=\"text\">Heading</h2>",
        "css": ".nv-heading { margin: 0; }"
      },
      "nv-paragraph": {
        "name": "Paragraph",
        "category": "basic",
        "slots": [],
        "html": "<div class=\"nv-paragraph\" data-nv-rich=\"text\">Write something great.</div>",
        "css": ".nv-paragraph { line-height: 1.65; }"
      },
      "hero": {
        "name": "Hero",
        "category": "content",
        "slots": [],
        "html": "<section class=\"hero\"><h1 data-nv-text=\"heading\"></h1></section>",
        "css": ".hero { background: var(--nv-color-surface, #faf9f7); }"
      }
    }
  }
}
```

- `blocks` maps every block ERC referenced anywhere in the COMPOSED tree, the page's own refs unioned with the resolved master's, to `{ name, category, slots, html, css }` (no propsSchema; the renderer does not validate). `html` and `css` are the block's template (spec 12), null for registry-rendered blocks. Only PUBLISHED blocks are included; a tree referencing a non-published block still renders (the map entry is simply present when the block row exists, whatever its status, since the page was validated at publish time).

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
