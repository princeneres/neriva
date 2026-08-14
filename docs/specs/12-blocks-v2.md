# Spec 12: Blocks v2, template rendering, native components and per-instance styles

Status: approved for implementation. Implements ADR-003. Brings block authoring to Liferay-fragment parity: HTML+CSS templates with editable bindings, a native component library, and per-block-instance styles with Style Book defaults.

## 1. Block template model (API)

`blocks` table gains two nullable columns: `html` (text) and `css` (text). A block with `html` renders through the template engine; without it, the legacy registry/generic path applies.

### Template syntax (v1)

- `{{propKey}}`: interpolation, ALWAYS HTML-escaped. Valid in text content and attribute values.
- Binding attributes (make the element render the prop AND become inline-editable on the studio canvas):
  - `data-nv-text="propKey"`: element text content, plain text.
  - `data-nv-rich="propKey"`: element inner HTML, sanitized rich text (allowed: p, br, b, strong, i, em, a[href], ul, ol, li).
  - `data-nv-image="propKey"`: sets `src`; optional companion `data-nv-alt="otherKey"`.
  - `data-nv-link="propKey"`: sets `href`.
- Slots: `data-nv-slot="name"` on an EMPTY element; its children are replaced by the slot content.
- Reserved engine hook (amendment, header/footer nav): `data-nv-nav="pages"` marks an element whose entire inner content is replaced at render time with `<a href="path">title</a>` links built from the site's own published pages, supplied by the renderer (not a propsSchema key). The fixed value `"pages"` is the only value accepted on write. Unlike text/rich bindings it is exempt from the leaf-only constraint below: since its content is always discarded and replaced, an authored placeholder link inside it is a harmless preview default, not a risk. When the caller does not supply a page list (e.g. the bare block preview), the authored placeholder is kept as-is.
- v1 constraints (validated on write, 400 when violated): binding attributes only on leaf elements (no nested tags inside; `data-nv-nav` is exempt, see above), slot elements must be empty, slot names referenced in the template must exist in the declared `slots`, bound propKeys must exist in the props schema, `data-nv-nav` must equal `"pages"`.

### Sanitization (write time, module-local helper)

- Reject `<script`, `<iframe` (v1), `on*=` event handler attributes, `javascript:`/`data:text` URLs in the html.
- CSS: reject `@import`, `expression(`, `url(javascript`.
- Render-time rule (web): prop values are always escaped (or sanitized for `data-nv-rich`); templates never receive raw editor input.

### API surface

- `POST/PATCH /blocks` accept `html`/`css`; GET responses include them. Publish flow unchanged.
- Delivery (`GET /public/sites/:slug/page`): the `blocks` map entries gain `html` and `css` (nullable) so the public renderer can render templates. Update spec 10's shape accordingly.
- Delivery (amendment, header/footer nav): the response's `site` object also carries `pages: { title, path }[]`, the site's own PUBLISHED pages ordered by path and capped at 50, feeding every `data-nv-nav="pages"` binding on the page. `GET /style-books/:id/css` and `GET /public/sites/:slug/style.css` are unaffected; nav is page-tree data, not a style token.

## 2. Native component library (seed)

A `NativeBlocksSeedService` (DbModule, after SeedService, idempotent by ERC, always on, `SEED_NATIVE_BLOCKS !== 'false'`) seeds PUBLISHED template blocks with ERC prefix `nv-`, category per row, JSON Schema titles/descriptions on every prop, template css using `var(--nv-*)` tokens with sensible fallbacks:

| ERC          | Category | Props / slots                                                                                                                                                                                                                                                                                                                                         |
| ------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| nv-header    | layout   | siteName (data-nv-text), tagline (data-nv-text, optional), logoUrl (data-nv-image, optional; a default mark is shown until one is set); nav via `data-nv-nav="pages"`; a CSS-only light/dark toggle (checkbox `#nv-theme-toggle`, no script) that gates the Style Book's dark token block, scoped to `.nv-site-root` so it never reaches the admin UI |
| nv-footer    | layout   | text (data-nv-rich, copyright line); nav via `data-nv-nav="pages"`; pinToBottom (enum `bottom` default / `after-content`) rendering the `nv-pin-{{pinToBottom}}` class next to the static `nv-pin-bottom` marker the page shell pins on (see section 5)                                                                                               |
| nv-container | layout   | background (string), slot `content`                                                                                                                                                                                                                                                                                                                   |
| nv-columns-2 | layout   | slots `left`, `right`                                                                                                                                                                                                                                                                                                                                 |
| nv-columns-3 | layout   | slots `a`, `b`, `c`                                                                                                                                                                                                                                                                                                                                   |
| nv-heading   | basic    | text (data-nv-text), level (enum h1-h4 via {{level}} class)                                                                                                                                                                                                                                                                                           |
| nv-paragraph | basic    | text (data-nv-rich)                                                                                                                                                                                                                                                                                                                                   |
| nv-button    | basic    | label (data-nv-text), url (data-nv-link), variant (enum primary/outline)                                                                                                                                                                                                                                                                              |
| nv-image     | media    | url (data-nv-image), alt (data-nv-alt companion), caption (data-nv-text, optional)                                                                                                                                                                                                                                                                    |
| nv-card      | basic    | title (data-nv-text), body (data-nv-rich), imageUrl (data-nv-image, optional)                                                                                                                                                                                                                                                                         |
| nv-separator | basic    | (none; an hr styled with tokens)                                                                                                                                                                                                                                                                                                                      |
| nv-spacer    | basic    | size (enum sm/md/lg -> class)                                                                                                                                                                                                                                                                                                                         |
| nv-video     | media    | url (YouTube/Vimeo embed via iframe allowlist rendered by the engine, NOT raw iframe in template: the engine special-cases `data-nv-embed="propKey"` rendering a sandboxed iframe for allowlisted hosts)                                                                                                                                              |
| nv-html      | advanced | html (string prop rendered UNESCAPED; the block's own description warns about it; creating/updating pages using it requires nothing special, but the prop is sanitized with the same write-time rules)                                                                                                                                                |
| nv-post-list | content  | heading, contentType (ref), pageSize (1-24, default 6), showSearch (default true), summaryField / bodyField / dateField / imageField (field keys, defaulting to summary / body / publishedOn / thumbnail), emptyText. Registry rendered, see section 2b                                                                                               |
| nv-todo-list | content  | heading, objectDefinition (ref), titleField / doneField / priorityField / dueDateField (field keys, defaulting to title / done / priority / dueDate; clearing priority or dueDate hides that control). Registry rendered, see section 2b                                                                                                              |

The existing demo blocks (hero, rich-text, two-columns, image) get `html`/`css` templates via the demo seed as well, replacing their registry renderers as the source of truth (registry entries may remain as fallback).

## 2b. Registry-rendered native blocks (amendment)

A block whose content depends on live data cannot be expressed as a static template, so `nv-post-list` and `nv-todo-list` are seeded with `html` and `css` both null and are drawn by React components in `apps/web/lib/renderer/blocks/`, reached through the registry fallback (`rendererFor`). The delivery API already reports `html`/`css` as null for registry-rendered blocks, so no client change was needed. `NativeBlockDefinition.html` and `.css` are therefore `string | null`, and `seed-templates.spec.ts` asserts these two carry no template while every other native block still validates.

Both are `'use client'` components: React mounts them as islands inside the server-rendered tree. They are the only renderers allowed to use hooks, and they use plain HTML plus token-driven CSS like every other block, never the admin's Mantine kit. `RenderTree` and `BlockRenderProps` carry an optional `siteSlug` so a data-driven block knows which site to read; it is absent in a bare block preview, where these blocks render a short placeholder explaining what they will show once configured.

- `nv-post-list` calls the public delivery endpoint `GET /public/sites/:slug/content-entries` (spec 10) with `q`, `limit` and `cursor`, so it works for anonymous visitors. Previous and Next are driven by a client-side stack of visited cursors, because that pagination is forward only. **Limitation:** the posts are fetched in the browser, so they are not in the server-rendered HTML and crawlers do not see them. Server rendering the first page is deliberately out of scope for v1.
- `nv-todo-list` is a full CRUD over Object records through the authenticated endpoints (`GET`/`POST /object-definitions/:ref/records`, `PATCH`/`DELETE /object-records/:id`), sending the merged payload on PATCH because it replaces `data` wholesale. It reads the definition first so it renders the fields the Object actually declares. With no token it never calls the API and renders a short read-only panel pointing at `/login`; a 401 or 403 mid-session degrades the same way. Optimistic updates roll back on failure.
- Date-only field values (`YYYY-MM-DD`) are formatted in UTC by both blocks, since parsing them as UTC midnight and formatting in the viewer's zone would shift the calendar day.

## 3. Per-instance styles (pages)

Tree nodes gain an optional `styles` object (sibling of props/slots):

```json
{
  "block": "nv-heading",
  "props": {},
  "slots": {},
  "styles": { "marginTop": "token:space-lg", "textColor": "#333", "textAlign": "center" }
}
```

- Allowed keys (whitelist, all string values, max 100 chars): marginTop/Right/Bottom/Left, paddingTop/Right/Bottom/Left, background, textColor, fontSize, textAlign, borderRadius, borderWidth, borderColor, maxWidth, minHeight, alignSelf.
- Values are raw CSS values or `token:<token-name>` which the renderer resolves to `var(--nv-<token-name>)`.
- Pages API: tree validation accepts and preserves `styles` (unknown keys 400 with pointer); spec 03's node shape is updated.
- Rendering (web): every node is wrapped in a div carrying the resolved inline styles; absent styles add nothing.

## 4. Studio (web)

- Inspector gains tabs General (props, as today) / **Styles**: controls for the whitelist above; spacing as a compact box-model grid of four inputs each for margin/padding; color inputs offer the site's published Style Book tokens first (Select with swatches: `token:color-primary` etc.) plus a custom value; defaults show as placeholders ("from style book").
- **Inline editing on canvas**: after render, elements with `data-nv-text`/`data-nv-rich` become contentEditable when their block is selected; typing syncs to the bound prop (rich uses the same sanitizer allowlist). Image bindings show a small overlay button opening a URL prompt (media picker integration later).
- **Fluid drag and drop**: cross-container dnd with @dnd-kit: palette items and existing blocks can be dropped between any two blocks at ROOT and INSIDE ANY SLOT, with a visible insertion indicator line; dragging an existing block moves it (same or different container). Keyboard fallback buttons stay.
- Block editor (admin/blocks): new **Code** tab with HTML and CSS editors (monospace Textareas), template validation errors from the API shown inline; the realtime preview renders the template through the same engine.
- **Dark mode parity (amendment)**: the canvas root and the Preview mode's root both carry the `nv-site-root` class (matching the public page), so a `data-nv-nav="pages"`-bound header/footer's light/dark toggle behaves identically while editing, previewing, and on the live site. `use-site-preview-data.ts` (a shared hook) fetches the site's stylesheet and page list once per `siteSlug` for both the canvas and Preview mode.
- **Preview mode**: a dedicated non-editing render of the current (possibly unsaved) tree through the same `RenderTree` component the public site uses, with no selection/toolbar/drag chrome mounted at all.

## 5. Template engine (web, lib/renderer/template.ts)

Pure functions, server-safe (no DOM): tokenize the html string; substitute `{{prop}}` escaped; locate binding elements (leaf constraint makes regex-based inner-content replacement safe); split at slot elements; output segments rendered with dangerouslySetInnerHTML interleaved with slot ReactNodes. Scope css by prefixing each top-level selector with `[data-nv-b="<erc>"]` and emit one `<style>` per distinct block ERC on the page. Used by: public route, studio canvas, block preview.

**Public page shell (amendment)**: `apps/web/app/s/published-page.tsx` (shared by the `/s/<slug>/...` routes and the default-site root routes, spec 13) renders the composed tree (spec 14: master header, page blocks, master footer) inside one `<main>` wrapped in `.nv-site-root`, and adds no chrome of its own. The site footer is the page's `nv-footer` block; the runtime never renders a footer, so a page shows exactly the footer its master template puts there.

The shell provides the sticky-footer layout: `.nv-site-root` is a `min-height: 100vh` flex column, its `<main>` is a flex column that grows into the leftover space (`flex: 1 1 auto`), and a root-level block carrying `nv-pin-bottom` gets `margin-top: auto` so it absorbs that space. A page shorter than the viewport therefore ends with the footer at the bottom edge instead of leaving a gap under it; a taller page has no leftover space, `margin-top: auto` resolves to zero and the footer simply follows the content. Nothing is fixed or absolutely positioned, so the footer can never cover content. `nv-pin-after-content` on the same block cancels the pin: the rule is `.nv-site-root > main > *:has(.nv-pin-bottom):not(:has(.nv-pin-after-content))`. It matches on a descendant because a node with per-instance styles (section 3) renders inside an extra wrapper div, which is then the flex child of `<main>` instead of the block's own `[data-nv-b]` div; matching either level keeps the pin working in both cases. Any block, native or user authored, opts in by carrying `nv-pin-bottom` in its template. `nv-footer` carries it statically so pinning is the out-of-the-box behavior: an unset prop interpolates to the empty string, so the default cannot come from the schema `default` alone. The seed never retro-updates existing rows, so installs seeded before this amendment keep a footer template without the marker and render it right after the content until the block is edited.

**Header/footer nav (amendment)**: `renderTemplate` accepts an optional `sitePages: { title, path }[]`. Every `data-nv-nav="pages"` element's inner content is replaced with `<a href="{path}">{title}</a>` per page (both values HTML-escaped), joined with no separator (styled via CSS). When `sitePages` is omitted, the binding is left untouched so the template's authored placeholder renders (used by the bare block preview, which has no site context). The renderer never fetches anything itself; the caller (delivery API response, Studio canvas, Preview mode) supplies the list.

## Tests

- API unit: template validation (constraints, sanitization, `data-nv-nav`), styles whitelist, every seeded template passing the write-time rules plus `nv-footer`'s pin marker, opt-out class and pinned default (`src/db/seed-templates.spec.ts`); e2e: block with template CRUD + publish, page tree with styles round-trip, delivery exposes html/css and the site's `pages` nav list, native seed idempotent (including `nv-header`/`nv-footer`).
- Web: pure template engine unit tests would live in lib/ (vitest include covers lib/**) - tokenizer, escaping, slot splitting, css scoping, `renderNavList` and the `data-nv-nav` binding (placeholder kept when `sitePages` is omitted, replaced when supplied).
