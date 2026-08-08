# Spec 06: Style Book

Status: approved for implementation (Phase B). Admin UI is out of scope for this iteration; API only.

A Style Book is a versioned set of design tokens (colors, spacing, typography, radii). Blocks consume tokens as CSS variables; the default token set lives in packages/ui and stays the fallback.

## Data model

Table `style_books` (standard envelope + status, no customFields):

| Column  | Type         | Rules                                            |
| ------- | ------------ | ------------------------------------------------ |
| name    | varchar(255) | required, unique per tenant                      |
| version | integer      | required, default 1; incremented on each publish |
| tokens  | jsonb        | required; flat map of token name to string value |

Token names: `^[a-z][a-z0-9-]*$` (e.g. `color-primary`, `space-4`). Values: non-empty strings (CSS values, not validated as CSS in v1). Rendered CSS variables are prefixed `--nv-`.

Unique indexes: `(tenant_id, external_reference_code)`, `(tenant_id, name)`.

## API

Permission resource: `style-book`.

| Method | Path                     | Permission         | Notes                                               |
| ------ | ------------------------ | ------------------ | --------------------------------------------------- |
| GET    | /style-books             | style-book:read    | cursor pagination                                   |
| GET    | /style-books/:id         | style-book:read    | UUID or erc:<code>                                  |
| POST   | /style-books             | style-book:create  | 201, status DRAFT, version 1                        |
| PATCH  | /style-books/:id         | style-book:update  | name, tokens                                        |
| DELETE | /style-books/:id         | style-book:delete  | 204                                                 |
| POST   | /style-books/:id/publish | style-book:publish | sets PUBLISHED, increments version                  |
| GET    | /style-books/:id/css     | style-book:read    | `text/css` body: `:root { --nv-<token>: <value>; }` |

The `/css` endpoint is the consumption surface for the rendering runtime; it must set `content-type: text/css` and bypass the JSON envelope.

## Validation

- Token names and values validated on write; violations 400 listing the offending keys.
- Duplicate name or ERC: 409.

## Tests

- Unit: token map validation, CSS rendering.
- e2e: CRUD, publish increments version, /css output shape and content type, permission denied case.
