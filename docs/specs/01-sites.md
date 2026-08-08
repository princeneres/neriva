# Spec 01: Sites

Status: approved for implementation (Phase B). Admin UI screens are out of scope for this iteration; API only.

A Site is the container for pages and site-scoped content (Liferay: Site/Group). Sites are tenant-scoped.

## Data model

Table `sites` (standard envelope + customFields, no status column: sites are always live):

| Column      | Type         | Rules                                                   |
| ----------- | ------------ | ------------------------------------------------------- |
| name        | varchar(255) | required                                                |
| slug        | varchar(100) | required, unique per tenant, `^[a-z0-9]+(-[a-z0-9]+)*$` |
| description | text         | nullable                                                |

Unique indexes: `(tenant_id, external_reference_code)`, `(tenant_id, slug)`.

## API

Permission resource: `site`.

| Method | Path       | Permission  | Notes                                              |
| ------ | ---------- | ----------- | -------------------------------------------------- |
| GET    | /sites     | site:read   | cursor pagination                                  |
| GET    | /sites/:id | site:read   | :id is UUID or erc:<code>                          |
| POST   | /sites     | site:create | 201, slug required                                 |
| PATCH  | /sites/:id | site:update | name, slug, description                            |
| DELETE | /sites/:id | site:delete | 204; 409 later when pages exist (not enforced yet) |

Responses use the `{ data, meta }` envelope, errors RFC 7807. Duplicate slug or ERC returns 409.

## Validation

- slug normalized to lowercase; reject invalid pattern with 400.
- DTOs with class-validator + @nestjs/swagger decorators (follow roles module pattern).

## Tests

- e2e: CRUD happy path, erc: lookup, duplicate slug 409, permission denied for a role without site grants, tenant scoping via repository (unit if simpler).
