# Spec 07: System settings

Status: implemented. Revised to add the settings catalog and the guided Admin UI screen.

Tenant-level system settings editable via API and in the Admin UI. The database connection and every other boot-time value is environment-level configuration (env vars) and is explicitly NOT a setting: `DATABASE_URL`, `MEDIA_STORAGE_DIR`, `MEDIA_MAX_UPLOAD_BYTES`, `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `WEB_ORIGIN`, `API_PORT`. The Settings screen lists those by name, with no values, so nobody looks for a field that will never be there.

## Data model

Table `system_settings` (reduced envelope: no status, no customFields, no ERC semantics beyond the envelope default):

| Column | Type         | Rules                                             |
| ------ | ------------ | ------------------------------------------------- |
| key    | varchar(100) | required, unique per tenant, `^[a-z][a-z0-9.-]*$` |
| value  | jsonb        | required (any JSON shape)                         |

Unique indexes: `(tenant_id, external_reference_code)`, `(tenant_id, key)`.

No migration is needed for the catalog: it is code, not rows. Nothing is seeded; an unset setting falls back to the catalog default, or to whatever fallback its consumer already has.

## Settings catalog

The table stays free-form, and the catalog is the _described_ subset of it (`apps/api/src/modules/system/settings-catalog.ts`). It exists so a client can render a typed form instead of asking a user to hand-write JSON, and it is served over REST so that capability is not Admin-UI-only knowledge (headless-first, CLAUDE.md principle 1).

Each definition carries: `key`, `group`, `label`, `description`, `type` (`string` | `text` | `number` | `boolean` | `select` | `password`), `defaultValue`, `options` or `optionsSource`, `placeholder`, and two honesty fields:

- `effect`: `APPLIED` when something in Neriva reads the value today, `STORED` when the row is only kept for a feature that does not exist yet.
- `effectNote`: one plain sentence naming where it takes effect, or why it does not.

Groups carry an optional `notice`, shown above the whole group. A group whose settings are all `STORED` must have one; a unit test enforces that, so a group of fields that does nothing can never ship without saying so.

### Catalog contents

| Key             | Group | Type     | Default | Effect  | Read by                                                                        |
| --------------- | ----- | -------- | ------- | ------- | ------------------------------------------------------------------------------ |
| `site.default`  | site  | select   | none    | APPLIED | Delivery API default-site resolution (spec 13) and the admin "Visit site" link |
| `smtp.host`     | email | string   | `""`    | STORED  | nothing                                                                        |
| `smtp.port`     | email | number   | `587`   | STORED  | nothing                                                                        |
| `smtp.secure`   | email | boolean  | `false` | STORED  | nothing                                                                        |
| `smtp.user`     | email | string   | `""`    | STORED  | nothing                                                                        |
| `smtp.password` | email | password | `""`    | STORED  | nothing                                                                        |
| `smtp.from`     | email | string   | `""`    | STORED  | nothing                                                                        |

Neriva sends no email: there is no mail client anywhere in the product. The SMTP group is kept because the keys were already documented and the values have to live somewhere when the feature lands, and its `notice` states plainly that saving them changes nothing today.

`site.name` and `site.description` are deliberately NOT in the catalog. A site's public name and description belong to the Site entity, which is what the delivery API actually serves; tenant-level copies would be a second place to edit the same thing and nothing would read them. They remain legal free-form keys.

### Not in the catalog, and why

- **Timezone, locale, date format.** The admin formats dates with the browser's own `toLocaleString()` across every screen. A setting would only be honoured if those screens read it, which is a change across the whole admin, not a settings change. Adding the field first would mean a control that visibly does nothing.
- **Upload limits.** `MEDIA_MAX_UPLOAD_BYTES` is applied to the Fastify multipart parser at boot (`apps/api/src/app.setup.ts`), before any tenant is known. It stays env.
- **Password policy.** No policy exists to configure: `auth` and `users` validate nothing beyond presence today.

## API

Permission resource: `system-setting`. Settings can hold secrets, so read is also permission-gated.

| Method | Path                     | Permission            | Notes                            |
| ------ | ------------------------ | --------------------- | -------------------------------- |
| GET    | /system/settings-catalog | system-setting:read   | catalog merged with stored state |
| GET    | /system/settings         | system-setting:read   | cursor pagination                |
| GET    | /system/settings/:key    | system-setting:read   | by key, not by id                |
| PUT    | /system/settings/:key    | system-setting:update | upsert: 200 update, 201 create   |
| DELETE | /system/settings/:key    | system-setting:delete | 204                              |

PUT body: `{ "value": <any JSON> }`. The `:key` segment is the setting key (validated by the pattern above), not an entity ref.

`GET /system/settings-catalog` returns `{ data: { groups, settings } }`. Every catalog entry is returned whether or not a row exists, extended with `isSensitive`, `isSet`, `value` (the stored value, `null` when unset or sensitive) and `updatedAt`. One request is therefore enough to draw a complete settings form.

The catalog lives at its own path rather than `/system/settings/catalog`, because `catalog` is a legal setting key and a metadata route there would hide that row from GET.

### Catalog types are descriptive, not enforced

PUT stays permissive: any JSON is accepted for any key, catalog or not. The catalog declares the shape a value is _expected_ to have, the same way OpenAPI declares one; it does not narrow what the API accepts. This keeps existing clients working (delivery already tolerates a non-string `site.default` and falls back) and keeps the headless API from rejecting a value a future consumer would understand. Clients coerce to the declared type before writing, and the Admin UI refuses to flatten a value whose stored JSON does not fit the typed input, offering the raw editor instead.

## Sensitive values

A value is redacted from every response (`value: null`, `isSensitive: true`) when its key ends in `password`, `secret`, `token`, `api-key` or `private-key`, **or** when the catalog declares it as type `password`. The catalog can only widen that set, never narrow it, so a catalog password field whose key does not match the suffix rule is still redacted. Redaction covers `GET /system/settings`, `GET /system/settings/:key` and the catalog alike.

## Admin UI

`/admin/settings` renders one card per catalog group with typed inputs (`Select`, `NumberInput`, `Switch`, password `TextInput`), each labelled in plain language and carrying its `effectNote` as a `HelpTip`. The default-site select is filled from the sites list, is clearable back to "Automatic", and keeps a stored slug that matches no site visible rather than silently dropping it.

- Clearing a field and saving DELETEs the row, which is the only way back to the catalog default.
- A password input starts blank, since the stored value is never returned; blank means "keep what is stored", and a separate Remove action deletes it.
- Saving a group sends only what changed, and skips writing a value identical to the default.
- A "Custom settings" card keeps the raw key/value table, the free-form create screen and the JSON editor, for keys nobody has described. The API is headless-first, so an undescribed key is a first-class thing to store, not an error.

## Validation

- Invalid key pattern: 400. Missing value: 400.

## Tests

- Unit (`settings-catalog.spec.ts`): every catalog key matches the key pattern, keys are unique, every group referenced exists, defaults match their declared type, options only appear on selects, a group of only-`STORED` settings has a notice, and every `password` entry is reported sensitive by `isSensitiveSettingKey`.
- e2e: PUT creates (201) then updates (200), GET by key, list, DELETE, invalid key 400, permission denied case; the catalog returns groups, defaults and effects, reports stored vs unset, never returns a stored password, is gated behind `system-setting:read`, and does not shadow a stored key named `catalog`.
