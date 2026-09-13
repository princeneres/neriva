# Spec 04: Content Types and Content Entries

Status: approved for implementation (Phase B, after sites merges). Admin UI is out of scope for this iteration; API only.

Structured content (Liferay: DDM Structure + Web Content). A Content Type declares fields; a Content Entry holds values conforming to its type. Client-defined fields are metadata + JSONB, never DDL.

## Data model

Table `content_types` (standard envelope, no status, no customFields):

| Column      | Type         | Rules                         |
| ----------- | ------------ | ----------------------------- |
| name        | varchar(255) | required, unique per tenant   |
| description | text         | nullable                      |
| fields      | jsonb        | required; array of field defs |

Field definition shape:

```json
{ "key": "headline", "label": "Headline", "type": "text", "required": true }
```

- `key`: `^[a-z][a-zA-Z0-9]*$`, unique within the type.
- `type`: one of `text`, `richtext`, `number`, `boolean`, `date` (ISO 8601 string).
- `required`: default false.

Table `content_entries` (standard envelope + status + customFields):

| Column        | Type         | Rules                                                                                     |
| ------------- | ------------ | ----------------------------------------------------------------------------------------- |
| contentTypeId | uuid         | required, FK content_types.id (restrict delete: deleting a type with entries returns 409) |
| siteId        | uuid         | nullable, FK sites.id (null = tenant-wide)                                                |
| title         | varchar(255) | required                                                                                  |
| values        | jsonb        | required; validated against the type fields                                               |

Unique `(tenant_id, external_reference_code)` on both tables.

## API

Permission resources: `content-type`, `content-entry`.

| Method           | Path                         | Permission                                                                                                       |
| ---------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| GET/POST         | /content-types               | content-type:read / content-type:create                                                                          |
| GET/PATCH/DELETE | /content-types/:id           | content-type:read / update / delete                                                                              |
| GET/POST         | /content-entries             | content-entry:read / create; `?contentType=<ref>` and `?site=<ref>` filters on GET                               |
| GET/PATCH/DELETE | /content-entries/:id         | content-entry:read / update / delete; PATCH accepts optional `expectedUpdatedAt` and returns 409 for stale edits |
| POST             | /content-entries/:id/publish | content-entry:publish                                                                                            |

## Validation

- Values are validated against the field definitions on create/update: unknown keys 400, missing required 400, wrong primitive type 400. Number = JS number, boolean = boolean, date = ISO 8601 string (validated), text/richtext = string.
- Changing a content type's fields does not retro-validate existing entries (documented limitation, v1).

## Tests

- Unit: field definition validation, values validation.
- e2e: type CRUD, entry CRUD against a type, invalid values 400, publish, delete type with entries 409, filters by contentType, permission denied case.
