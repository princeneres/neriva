# Spec 05: Objects

Status: approved for implementation (Phase B). Admin UI is out of scope for this iteration; API only.

Objects are client-defined entities (Liferay: Liferay Objects): an Object Definition declares fields, Object Records hold data in JSONB. No dynamic DDL. This is the one module where Kysely is allowed, for dynamic filtering over runtime-defined fields.

## Data model

Table `object_definitions` (standard envelope, no status, no customFields):

| Column       | Type         | Rules                                                |
| ------------ | ------------ | ---------------------------------------------------- |
| name         | varchar(255) | required, unique per tenant                          |
| pluralName   | varchar(255) | required                                             |
| description  | text         | nullable                                             |
| fields       | jsonb        | required; array of field defs                        |
| publicAccess | enum         | required; `none` (default) \| `read` \| `read-write` |

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

## Anonymous access (amendment)

A dynamic block on a published page has to work for a visitor who is not signed in. Until this amendment every Objects route was authenticated, so such a block rendered empty and any write returned 401.

### The model: one opt-in ladder, not a set of flags

`object_definitions.publicAccess` is an enum with three ordered values:

| Mode         | An anonymous visitor can                                                                              | An anonymous visitor cannot                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `none`       | nothing; the definition answers 404 on the public surface, exactly like one that does not exist       | everything                                                                                 |
| `read`       | fetch the definition (name, plural name, description, fields) and list/filter/sort/search its records | create, update or delete any record; see the management envelope                           |
| `read-write` | everything `read` allows, plus create a record and update or delete **any** record of that definition | choose its own `externalReferenceCode`; touch any other definition; exceed the write limit |

Why an enum and not two booleans (`publicRead`, `publicWrite`): "writable but not readable" is not a state anyone wants, and two independent flags make it reachable by accident. The ladder also matches the real decisions: a product catalogue wants `read`, a shared demo to-do list wants `read-write`, everything else wants `none`.

**Anonymous writes are unowned, and that is a property of the mode, not an oversight.** There is no anonymous identity, so there is nothing to attribute a record to and nothing to check an edit against: under `read-write` any visitor may change or delete any record of that definition, including records other visitors created. That is the shared-whiteboard model the demo to-do list needs. It is the wrong mode for anything that is not already safe to publish, and the admin screen says so in those words before the choice is saved.

### Rules

- **Fail closed.** The column is `NOT NULL DEFAULT 'none'`, so every row that existed before the migration, and every definition created without naming the mode, is private. No migration may publish data nobody reviewed.
- **No enumeration.** There is no `GET /public/object-definitions`. A visitor can only address a definition whose reference it already has.
- **No existence oracle.** A definition in `none` and a definition that does not exist both answer 404 problem+json. A read-only definition refusing a write answers 403, because its existence is already public at that point and a useful error beats a misleading one. A malformed reference is still a 400, like everywhere else.
- **No management envelope.** The public definition payload is `{ id, externalReferenceCode, name, pluralName, description, publicAccess, fields }`; the public record payload is `{ id, externalReferenceCode, data, createdAt, updatedAt }`. `tenantId`, `createdBy`, `folderId` and `objectDefinitionId` are never exposed.
- **Records hang off their definition.** Public records are addressed as `/public/object-definitions/:defRef/records/:recordId`, never as a bare `/public/object-records/:id`. Resolving the definition first is what keeps one published object from becoming a handle on every other object's records; a record id belonging to another definition answers 404.
- **Tenant scoping.** The public surface resolves the default tenant the same way delivery and login do, and every query stays tenant-scoped.
- **Anonymous writes are unattributed.** `createdBy` is null and the caller's `externalReferenceCode` is ignored, so a visitor cannot squat the stable code an integration addresses a record by.

### Endpoints (all `@Public`, no bearer token)

| Method | Path                                                 | Requires     | Rate limit |
| ------ | ---------------------------------------------------- | ------------ | ---------- |
| GET    | /public/object-definitions/:defRef                   | `read`       | 120/min/IP |
| GET    | /public/object-definitions/:defRef/records           | `read`       | 120/min/IP |
| POST   | /public/object-definitions/:defRef/records           | `read-write` | 20/min/IP  |
| PATCH  | /public/object-definitions/:defRef/records/:recordId | `read-write` | 20/min/IP  |
| DELETE | /public/object-definitions/:defRef/records/:recordId | `read-write` | 20/min/IP  |

The listing accepts the same `filter[...]`, `sort`, `search`, `limit` and `cursor` as the management listing; they operate on data that is already public.

### Rate limiting

Anonymous writes carry `@Throttle({ default: { limit: 20, ttl: 60_000 } })`, per IP and in memory, the same mechanism as the login limit. Reads carry 120/min/IP, well above what a page load costs (one definition plus one record page) and still a cap on a scraper walking the cursor. The client IP is `request.ip`, which honours `TRUST_PROXY`, so a deploy behind a configured reverse proxy limits the real caller and not the proxy.

### Payload ceilings

`validateRecordData` enforces size limits for every caller, not only anonymous ones: 10,000 characters per `text` value and 64 KB for the serialized `data` payload. Anonymous writes run under tighter ceilings, 1,000 characters and 4 KB, because there is no account behind them to hold responsible. The payload limit is measured in bytes, so padding with multi-byte characters buys no extra room.

### Module placement

The controller lives in `apps/api/src/modules/objects/`, not in `delivery/`. Delivery is site-scoped and read-only by definition (spec 10); this surface is tenant-scoped and carries writes. What it borrows from delivery is the `/public` prefix, the "no bearer token" contract and the rule that the management envelope stays private.

## Dynamic filtering (Kysely)

`GET /object-definitions/:defRef/records` accepts:

- `?filter[<fieldKey>]=<value>` equality filters on JSONB fields (multiple allowed, ANDed). Values are coerced by the field type (number, boolean); unknown field keys return 400.
- `?sort=<fieldKey>` or `?sort=-<fieldKey>` (descending), JSONB extraction; default sort stays id asc.
- Cursor pagination as everywhere. Cursor + custom sort: v1 only supports cursors with the default id sort; using `sort` with `cursor` returns 400 (documented limitation).

Implement the filtered query with Kysely over the `object_records` table (`data -> 'key'` extraction), always including the tenant filter. Add `kysely` as a dependency of apps/api; reuse the same pg Pool.

## Validation

- Record data validated like content entries (unknown keys 400, required 400, type check, picklist membership).
- Size ceilings on every write, tighter for anonymous ones; see "Payload ceilings" above.

## Tests

- Unit: field/data validation, filter parsing, the text and payload size ceilings.
- e2e: definition CRUD, record CRUD, filter by text/number/boolean field, sort, unknown filter key 400, delete definition with records 409, permission denied case.
- e2e (`test/public-objects.e2e-spec.ts`): a definition is created private by default; an anonymous caller gets 404 on a private definition, on its records and on a write to it, and the same 404 on one that does not exist; anonymous reads work in `read` mode and return neither the management envelope nor another definition's records; an anonymous write is 403 in `read` mode and succeeds in `read-write` mode; a record id from another definition is 404 under a `read-write` definition; anonymous records are created with a null `createdBy` and a generated ERC; the payload ceiling rejects an oversized value; flipping the mode back to `none` closes the surface immediately; and anonymous writes hit a 429 problem+json while anonymous reads keep working.
