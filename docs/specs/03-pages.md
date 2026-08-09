# Spec 03: Pages

Status: approved for implementation (Phase B, after sites and blocks merge). Admin UI and the Next.js rendering runtime are out of scope for this iteration; API only.

A Page is data: a JSON tree of Block instances (block ref + prop values + slot children) belonging to a Site. Headless clients consume the raw tree.

## Data model

Table `pages` (standard envelope + status + customFields):

| Column               | Type         | Rules                                                  |
| -------------------- | ------------ | ------------------------------------------------------ |
| siteId               | uuid         | required, FK sites.id (cascade delete)                 |
| title                | varchar(255) | required                                               |
| path                 | varchar(255) | required, unique per site, `^/[a-z0-9/-]*$`            |
| tree                 | jsonb        | required, default `{ "blocks": [] }`                   |
| masterPageTemplateId | uuid         | nullable, FK page_templates.id (set null), see spec 14 |

Tree shape (recursive):

```json
{
  "blocks": [
    {
      "block": "<block ERC>",
      "props": { "...": "validated against the block propsSchema" },
      "slots": { "<slotName>": [{ "block": "...", "props": {}, "slots": {} }] }
    }
  ]
}
```

Unique indexes: `(tenant_id, external_reference_code)`, `(site_id, path)`.

## API

Permission resource: `page`.

| Method | Path                  | Permission   | Notes                                                             |
| ------ | --------------------- | ------------ | ----------------------------------------------------------------- |
| GET    | /sites/:siteRef/pages | page:read    | pages of a site, cursor pagination                                |
| POST   | /sites/:siteRef/pages | page:create  | 201; accepts `templateId` and `masterPageTemplateId`, see spec 14 |
| GET    | /pages/:id            | page:read    | returns the full tree and the page's own `masterPageTemplateId`   |
| PATCH  | /pages/:id            | page:update  | title, path, tree, `masterPageTemplateId`                         |
| DELETE | /pages/:id            | page:delete  | 204                                                               |
| POST   | /pages/:id/publish    | page:publish | validates the whole tree, sets PUBLISHED                          |

Spec 14 amendment: `POST /sites/:siteRef/pages` also accepts an optional create-only `templateId` (a STANDARD page template ref whose tree is copied once as the initial tree) and an optional `masterPageTemplateId` (a MASTER page template ref, PATCH-able afterwards). `GET /pages/:id` returns the page's own `masterPageTemplateId`, or null when it relies on the tenant default; delivery composes the effective master separately (spec 10, spec 14).

## Validation

- On any tree write: every `block` ERC must exist in the tenant; slot names must exist in the referenced block's declared slots; props are validated against the block's `propsSchema` with Ajv. Violations return 400 with a pointer to the offending node (e.g. `blocks[0].slots.main[2]`).
- On publish: additionally, every referenced block must be PUBLISHED.
- Path collisions return 409.

## Tests

- e2e: create page with valid tree, invalid block ref 400, invalid props 400, unknown slot 400, publish with DRAFT block 400 (or 422; pick 400 and document), publish happy path, (site_id, path) uniqueness 409, permission denied case.
