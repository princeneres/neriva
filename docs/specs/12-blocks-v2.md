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
- v1 constraints (validated on write, 400 when violated): binding attributes only on leaf elements (no nested tags inside), slot elements must be empty, slot names referenced in the template must exist in the declared `slots`, bound propKeys must exist in the props schema.

### Sanitization (write time, module-local helper)

- Reject `<script`, `<iframe` (v1), `on*=` event handler attributes, `javascript:`/`data:text` URLs in the html.
- CSS: reject `@import`, `expression(`, `url(javascript`.
- Render-time rule (web): prop values are always escaped (or sanitized for `data-nv-rich`); templates never receive raw editor input.

### API surface

- `POST/PATCH /blocks` accept `html`/`css`; GET responses include them. Publish flow unchanged.
- Delivery (`GET /public/sites/:slug/page`): the `blocks` map entries gain `html` and `css` (nullable) so the public renderer can render templates. Update spec 10's shape accordingly.

## 2. Native component library (seed)

A `NativeBlocksSeedService` (DbModule, after SeedService, idempotent by ERC, always on, `SEED_NATIVE_BLOCKS !== 'false'`) seeds PUBLISHED template blocks with ERC prefix `nv-`, category per row, JSON Schema titles/descriptions on every prop, template css using `var(--nv-*)` tokens with sensible fallbacks:

| ERC          | Category | Props / slots                                                                                                                                                                                            |
| ------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| nv-container | layout   | background (string), slot `content`                                                                                                                                                                      |
| nv-columns-2 | layout   | slots `left`, `right`                                                                                                                                                                                    |
| nv-columns-3 | layout   | slots `a`, `b`, `c`                                                                                                                                                                                      |
| nv-heading   | basic    | text (data-nv-text), level (enum h1-h4 via {{level}} class)                                                                                                                                              |
| nv-paragraph | basic    | text (data-nv-rich)                                                                                                                                                                                      |
| nv-button    | basic    | label (data-nv-text), url (data-nv-link), variant (enum primary/outline)                                                                                                                                 |
| nv-image     | media    | url (data-nv-image), alt (data-nv-alt companion), caption (data-nv-text, optional)                                                                                                                       |
| nv-card      | basic    | title (data-nv-text), body (data-nv-rich), imageUrl (data-nv-image, optional)                                                                                                                            |
| nv-separator | basic    | (none; an hr styled with tokens)                                                                                                                                                                         |
| nv-spacer    | basic    | size (enum sm/md/lg -> class)                                                                                                                                                                            |
| nv-video     | media    | url (YouTube/Vimeo embed via iframe allowlist rendered by the engine, NOT raw iframe in template: the engine special-cases `data-nv-embed="propKey"` rendering a sandboxed iframe for allowlisted hosts) |
| nv-html      | advanced | html (string prop rendered UNESCAPED; the block's own description warns about it; creating/updating pages using it requires nothing special, but the prop is sanitized with the same write-time rules)   |

The existing demo blocks (hero, rich-text, two-columns, image) get `html`/`css` templates via the demo seed as well, replacing their registry renderers as the source of truth (registry entries may remain as fallback).

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

## 5. Template engine (web, lib/renderer/template.ts)

Pure functions, server-safe (no DOM): tokenize the html string; substitute `{{prop}}` escaped; locate binding elements (leaf constraint makes regex-based inner-content replacement safe); split at slot elements; output segments rendered with dangerouslySetInnerHTML interleaved with slot ReactNodes. Scope css by prefixing each top-level selector with `[data-nv-b="<erc>"]` and emit one `<style>` per distinct block ERC on the page. Used by: public route, studio canvas, block preview.

## Tests

- API unit: template validation (constraints, sanitization), styles whitelist; e2e: block with template CRUD + publish, page tree with styles round-trip, delivery exposes html/css, native seed idempotent.
- Web: pure template engine unit tests would live in lib/ (vitest include covers lib/**) - tokenizer, escaping, slot splitting, css scoping.
