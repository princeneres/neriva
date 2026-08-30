# Spec 06: Style Book

Status: approved for implementation (Phase B). Admin UI is out of scope for this iteration; API only.

A Style Book is a versioned set of design tokens (colors, spacing, typography, radii). Blocks consume tokens as CSS variables; the default token set lives in packages/ui and stays the fallback.

## Data model

Table `style_books` (standard envelope + status, no customFields):

| Column     | Type         | Rules                                                       |
| ---------- | ------------ | ----------------------------------------------------------- |
| name       | varchar(255) | required, unique per tenant                                 |
| version    | integer      | required, default 1; incremented on each publish            |
| tokens     | jsonb        | required; flat map of token name to string value            |
| tokensDark | jsonb        | optional, nullable; same shape as `tokens` (dark overrides) |

Token names: `^[a-z][a-z0-9-]*$` (e.g. `color-primary`, `space-4`). Values: non-empty strings (CSS values, not validated as CSS in v1). Rendered CSS variables are prefixed `--nv-`.

### Dark mode (amendment)

A Style Book optionally carries `tokensDark`: dark-mode overrides for any subset of `tokens`. A token key absent from `tokensDark` falls back to a derived value rather than being left unset, so the toggle is never a no-op:

- Only tokens whose name is prefixed `color-` are eligible for derivation; every other token (spacing, radii, fonts) is theme-agnostic and always carries its light value forward unchanged, even in the dark block.
- The derivation looks at the role suffix after `color-`: `surface-alt` gets a distinct dark neutral, `surface`/`background` gets a dark neutral, `text` gets a light neutral, `border` gets a translucent light line. Any other `color-*` role is left unchanged.
- An explicit `tokensDark` entry always wins over the derived value.

This derivation is shared (not duplicated) between the Style Book module and the delivery module: see `apps/api/src/common/style-tokens.ts`.

Unique indexes: `(tenant_id, external_reference_code)`, `(tenant_id, name)`.

## API

Permission resource: `style-book`.

| Method | Path                     | Permission         | Notes                              |
| ------ | ------------------------ | ------------------ | ---------------------------------- |
| GET    | /style-books             | style-book:read    | cursor pagination                  |
| GET    | /style-books/:id         | style-book:read    | UUID or erc:<code>                 |
| POST   | /style-books             | style-book:create  | 201, status DRAFT, version 1       |
| PATCH  | /style-books/:id         | style-book:update  | name, tokens, tokensDark           |
| DELETE | /style-books/:id         | style-book:delete  | 204                                |
| POST   | /style-books/:id/publish | style-book:publish | sets PUBLISHED, increments version |
| GET    | /style-books/:id/css     | style-book:read    | `text/css` body, see below         |

The `/css` endpoint is the consumption surface for the rendering runtime; it must set `content-type: text/css` and bypass the JSON envelope. It emits three blocks (amended, see "Theme selection" below); a token map with no entries emits only an empty `:root {}` and no dark blocks at all:

1. `:root { --nv-<token>: <value>; }` with the light tokens.
2. `:root[data-nv-theme='dark'], .nv-site-root:has(#nv-theme-toggle:checked) { --nv-<token>: <dark value>; }` with the dark tokens. The attribute selector is the mechanism; the `:has()` selector is retained so a header block seeded with the original checkbox control keeps working without a re-seed.
3. The same dark declarations again inside `@media (prefers-color-scheme: dark) { :root:not([data-nv-theme='light']) { ... } }`, so a visitor whose OS is dark gets a dark first paint even with JavaScript disabled, while an explicit light choice still wins.

The delivery module's public equivalent, `/public/sites/:slug/style.css`, renders the same blocks from the same shared helper.

Every surface that renders a full page (the public page, the Page Studio canvas, and Preview mode) applies the `nv-site-root` class to its root element. The two admin surfaces additionally rewrite `:root` onto their own scope class and stamp an explicit `data-nv-theme`, so the site's tokens never leak into the admin chrome and the editor's OS preference never repaints the page being edited (`apps/web/lib/renderer/scope-css.ts`).

### Theme selection (amendment)

The selected theme is a persisted attribute on the document, not DOM state of a control inside a block template. The earlier checkbox-only mechanism could not persist: every link a block renders is a plain anchor, so each click was a full document load that served the checkbox unchecked and reverted the site to light, and it ignored the visitor's OS preference entirely.

- Source of truth: `data-nv-theme` on `<html>`, value `light` or `dark`.
- Resolution order: the `neriva.theme` localStorage key, then `prefers-color-scheme`, then light.
- Applied before first paint by a small inline script in the web root layout, so there is no flash of the wrong theme (`apps/web/lib/theme-script.ts`).
- Made interactive by a runtime client component mounted on every published page, which owns the click handling and the persistence and keeps the seeded checkbox in sync (`apps/web/app/s/theme-sync.tsx`). Block templates are sanitized data and cannot carry script, so the handler cannot live in the block.
- Namespaced away from Mantine, which owns `data-mantine-color-scheme` and the `mantine-color-scheme-value` key. The site theme and the admin chrome theme are independent by design.

### Page ground (amendment)

`color-background` is the page ground, distinct from `color-surface` (headers, hero sections, cards) so a dark token set can layer the two. `.nv-site-root` paints from `var(--nv-color-background, var(--nv-color-surface, #ffffff))`; the fallback chain lets a token set that predates `color-background` still darken. The page ground must never be inherited from `body`: the web app binds `body` to neutral tokens precisely so no admin chrome variable can pin a published page to a light canvas.

## Validation

- Token names and values validated on write for both `tokens` and `tokensDark`; violations 400 listing the offending keys.
- Duplicate name or ERC: 409.

## Tests

- Unit: token map validation, CSS rendering (light + dark blocks, the attribute and `:has()` selectors, the `prefers-color-scheme` block, derivation, explicit override), in `apps/api/src/common/style-tokens.spec.ts`. Theme resolution and the inline init script in `apps/web/lib/theme-script.spec.ts`.
- e2e: CRUD, publish increments version, /css output shape and content type (including the dark block), permission denied case.
