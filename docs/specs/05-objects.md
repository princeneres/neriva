# Spec 05: Objects

Status: approved for implementation (Phase B). Admin UI is out of scope for this iteration; API only.

Objects are client-defined entities (Liferay: Liferay Objects): an Object Definition declares fields, Object Records hold data in JSONB. No dynamic DDL. This is the one module where Kysely is allowed, for dynamic filtering over runtime-defined fields.

## Data model

Table `object_definitions` (standard envelope, no status, no customFields):

| Column      | Type         | Rules                         |
| ----------- | ------------ | ----------------------------- |
| name        | varchar(255) | required, unique per tenant   |
| pluralName  | varchar(255) | required                      |
| description | text         | nullable                      |
| fields      | jsonb        | required; array of field defs |

Field shape: `{ "key", "label", "type", "required" }` with `key` `^[a-z][a-zA-Z0-9]*$` unique in the definition, `type` in `text | number | boolean | date | picklist`, picklist adds `"options": ["a", "b"]`.

Table `object_records` (standard envelope + customFields omitted; `data` is the payload):

| Column             | Type  | Rules                                                                                         |
| ------------------ | ----- | --------------------------------------------------------------------------------------------- |
| objectDefinitionId | uuid  | required, FK object_definitions.id (restrict: deleting a definition with records returns 409) |
| data               | jsonb | required; validated against the definition fields                                             |

Unique `(tenant_id, external_reference_code)` on both tables.

## API

Permission resources: `object-definition`, `object-record`.

| Method           | Path                                | Permission                               |
| ---------------- | ----------------------------------- | ---------------------------------------- |
| GET/POST         | /object-definitions                 | object-definition:read / create          |
| GET/PATCH/DELETE | /object-definitions/:id             | object-definition:read / update / delete |
| GET/POST         | /object-definitions/:defRef/records | object-record:read / create              |
| GET/PATCH/DELETE | /object-records/:id                 | object-record:read / update / delete     |

## Dynamic filtering (Kysely)

`GET /object-definitions/:defRef/records` accepts:

- `?filter[<fieldKey>]=<value>` equality filters on JSONB fields (multiple allowed, ANDed). Values are coerced by the field type (number, boolean); unknown field keys return 400.
- `?sort=<fieldKey>` or `?sort=-<fieldKey>` (descending), JSONB extraction; default sort stays id asc.
- Cursor pagination as everywhere. Cursor + custom sort: v1 only supports cursors with the default id sort; using `sort` with `cursor` returns 400 (documented limitation).

Implement the filtered query with Kysely over the `object_records` table (`data -> 'key'` extraction), always including the tenant filter. Add `kysely` as a dependency of apps/api; reuse the same pg Pool.

## Validation

- Record data validated like content entries (unknown keys 400, required 400, type check, picklist membership).

## Tests

- Unit: field/data validation, filter parsing.
- e2e: definition CRUD, record CRUD, filter by text/number/boolean field, sort, unknown filter key 400, delete definition with records 409, permission denied case.
