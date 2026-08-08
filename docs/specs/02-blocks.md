# Spec 02: Blocks

Status: approved for implementation (Phase B). Admin UI screens are out of scope for this iteration; API only.

A Block is a typed component (Liferay: Fragment) declared as data: a JSON Schema of configurable props plus named slots. No string-template HTML editing.

## Data model

Table `blocks` (standard envelope + status column, no customFields):

| Column      | Type         | Rules                                                        |
| ----------- | ------------ | ------------------------------------------------------------ |
| name        | varchar(255) | required                                                     |
| category    | varchar(100) | nullable (e.g. "layout", "content")                          |
| description | text         | nullable                                                     |
| propsSchema | jsonb        | required; must be a valid JSON Schema (draft 2020-12) object |
| slots       | jsonb        | required, default `[]`; array of `{ name, allowedBlocks? }`  |

- `status`: DRAFT blocks cannot be referenced by published pages (enforced by the pages module later; blocks module only stores status).
- Unique index `(tenant_id, external_reference_code)`. Block ERC is the stable reference pages use.

## API

Permission resource: `block`.

| Method | Path                | Permission    | Notes                                         |
| ------ | ------------------- | ------------- | --------------------------------------------- |
| GET    | /blocks             | block:read    | cursor pagination; `?status=` optional filter |
| GET    | /blocks/:id         | block:read    | UUID or erc:<code>                            |
| POST   | /blocks             | block:create  | 201                                           |
| PATCH  | /blocks/:id         | block:update  |                                               |
| DELETE | /blocks/:id         | block:delete  | 204                                           |
| POST   | /blocks/:id/publish | block:publish | sets status PUBLISHED                         |

## Validation

- `propsSchema` is compiled with Ajv (draft 2020-12) at write time; compilation failure returns 400 with the Ajv error message in `detail`.
- `slots`: names unique, `^[a-z][a-z0-9-]*$`; `allowedBlocks` is an optional array of block ERCs (existence not enforced in v1).
- Add `ajv` as a dependency of apps/api.

## Tests

- Unit: schema/slots validation helper.
- e2e: CRUD, invalid propsSchema 400, duplicate slot name 400, publish transition, permission denied case.
