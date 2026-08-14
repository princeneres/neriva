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

The `/css` endpoint is the consumption surface for the rendering runtime; it must set `content-type: text/css` and bypass the JSON envelope. It always emits two blocks: `:root { --nv-<token>: <value>; }` with the light tokens, then `.nv-site-root:has(#nv-theme-toggle:checked) { --nv-<token>: <dark value>; }` with the dark tokens (see "Dark mode" above). The delivery module's public equivalent, `/public/sites/:slug/style.css`, renders the same two blocks from the same shared helper.

A block's header/footer template that carries the theme toggle checkbox (id `nv-theme-toggle`) must be a descendant of an ancestor carrying the `nv-site-root` class for the dark block's `:has()` selector to match; every surface that renders a full page (the public page, the Page Studio canvas, and Preview mode) applies that class to its root element.

## Validation

- Token names and values validated on write for both `tokens` and `tokensDark`; violations 400 listing the offending keys.
- Duplicate name or ERC: 409.

## Tests

- Unit: token map validation, CSS rendering (light + dark blocks, derivation, explicit override), in `apps/api/src/common/style-tokens.spec.ts`.
- e2e: CRUD, publish increments version, /css output shape and content type (including the dark block), permission denied case.
