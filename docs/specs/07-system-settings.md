# Spec 07: System settings

Status: approved for implementation (Phase B). Admin UI is out of scope for this iteration; API only.

Tenant-level system settings (SMTP, site metadata, etc.) editable via API. The database connection is environment-level configuration (env vars) and is explicitly NOT a setting.

## Data model

Table `system_settings` (reduced envelope: no status, no customFields, no ERC semantics beyond the envelope default):

| Column | Type         | Rules                                             |
| ------ | ------------ | ------------------------------------------------- |
| key    | varchar(100) | required, unique per tenant, `^[a-z][a-z0-9.-]*$` |
| value  | jsonb        | required (any JSON shape)                         |

Unique indexes: `(tenant_id, external_reference_code)`, `(tenant_id, key)`.

Well-known keys documented (not enforced): `smtp.host`, `smtp.port`, `smtp.user`, `smtp.password`, `site.name`, `site.description`.

## API

Permission resource: `system-setting`. Settings can hold secrets, so read is also permission-gated.

| Method | Path                  | Permission            | Notes                          |
| ------ | --------------------- | --------------------- | ------------------------------ |
| GET    | /system/settings      | system-setting:read   | cursor pagination              |
| GET    | /system/settings/:key | system-setting:read   | by key, not by id              |
| PUT    | /system/settings/:key | system-setting:update | upsert: 200 update, 201 create |
| DELETE | /system/settings/:key | system-setting:delete | 204                            |

PUT body: `{ "value": <any JSON> }`. The `:key` segment is the setting key (validated by the pattern above), not an entity ref.

## Validation

- Invalid key pattern: 400. Missing value: 400.

## Tests

- e2e: PUT creates (201) then updates (200), GET by key, list, DELETE, invalid key 400, permission denied case.
