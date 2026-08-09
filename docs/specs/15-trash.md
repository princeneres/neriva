# Spec 15: Trash (Recycle Bin)

Status: approved for implementation. Liferay equivalent: Recycle Bin. Deleting content moves it here instead of destroying it immediately; it can be restored or purged. Sites are the one exception: deleting a Site is immediate and cascades (unchanged v1 behavior), because a site's own deletion already implies deleting everything scoped to it.

## 1. Design

Capture-on-delete, not soft-delete-in-place: every other module keeps its live table exactly as it is today (no new columns, no query changes to existing list/get endpoints). When a covered entity is deleted, the full row (and, where meaningful, its light child rows) is serialized into one shared `trash_items` table and then hard-deleted from its origin table in the same transaction. This keeps the blast radius to each module's `delete()` method plus one new module, instead of touching every read path across the codebase.

### Covered entities (v1)

pages, blocks, page_templates, content_types, content_entries, object_definitions, object_records, style_books, media_folders, media_files. NOT covered (delete stays immediate, unchanged): sites, users, roles, system_settings, tenants.

### Table

`trash_items` (own envelope subset: id, externalReferenceCode, tenantId, createdAt; no updatedAt/status/customFields — a trash item does not change once created):

| Column      | Type         | Rules                                                                                                                                                                                                                                                                                                                  |
| ----------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| entityType  | varchar(40)  | required, one of the covered entity keys above (snake_case table name)                                                                                                                                                                                                                                                 |
| entityId    | uuid         | required; the original row's id (not unique alone: restoring then re-deleting can reuse it)                                                                                                                                                                                                                            |
| displayName | varchar(255) | required; a human label snapshotted at delete time (title/name/fileName/key as applicable)                                                                                                                                                                                                                             |
| payload     | jsonb        | required; the full original row, plus for `pages` the site's slug (needed to show "from which site" without a join to a since-possibly-changed site) and for `content_entries`/`object_records`/`media_files` their parent's displayName (content type name / definition name / folder path) for display purposes only |
| deletedBy   | uuid         | nullable (the acting user id)                                                                                                                                                                                                                                                                                          |
| deletedAt   | timestamptz  | required, default now                                                                                                                                                                                                                                                                                                  |

No `expiresAt`/auto-purge in v1 (documented limitation; manual empty-trash only). Index on `(tenant_id, entity_type)` and `(tenant_id, deleted_at)`.

## 2. API surface

Permission resource: `trash` (read/restore/delete). Each covered module's existing `:resource:delete` permission still gates the delete action itself (moving to trash is the deletion); trash-specific permissions gate what happens to it afterward.

| Method | Path               | Permission    | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------ | ------------------ | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | /trash             | trash:read    | cursor pagination; `?type=<entityType>` filter; response items: `{ id, entityType, entityId, displayName, deletedAt, deletedBy }` (no `payload` in the list)                                                                                                                                                                                                                                                                                                          |
| GET    | /trash/:id         | trash:read    | full item incl. `payload`                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| POST   | /trash/:id/restore | trash:restore | re-inserts the row into its origin table inside a transaction, then removes the trash item; a uniqueness conflict at the origin table (e.g. a new item already took the same slug/path/key) returns 409 with a detail naming the conflicting field, leaving the trash item intact so the user can rename the live conflict or the trash item's restore target and retry (v1 has no rename-on-restore UI requirement, but the API must not silently fail or duplicate) |
| DELETE | /trash/:id         | trash:delete  | permanent delete; for `media_files` payloads, also unlinks the stored bytes (best-effort, same pattern as the existing media delete)                                                                                                                                                                                                                                                                                                                                  |
| DELETE | /trash             | trash:delete  | empties the entire tenant's trash (same per-item cleanup as above)                                                                                                                                                                                                                                                                                                                                                                                                    |

## 3. Wiring existing modules

Each covered service's `delete()` (and, for `object_definitions`/`content_types`/`media_folders`, any place that currently blocks deletion with a 409 because children exist) changes to: **move the row to trash instead of blocking**, since children move to trash too in the same transaction (cascade rows: deleting a `content_types` row already relied on a DB FK; for trash purposes, when a parent with children is trashed, its children are trashed in the same transaction as individual trash_items rows too, so restoring the parent does not automatically restore children — document this v1 limitation directly in the code comment and in this spec). This REMOVES the current 409-on-children-exist behavior for content types, object definitions, and media folders (delete now always succeeds by moving everything to trash); media_folders' cascade delete of subfolders/files (today's hard-cascade) becomes: recursively snapshot the whole subtree into individual trash_items rows, then delete the subtree.

A small shared `TrashService` (new `trash` module, exported) provides `moveToTrash(tx, { entityType, entityId, displayName, payload, deletedBy })` for the other modules to call inside their own transaction, and the restore/list/purge logic. Modules import `TrashModule`'s exported `TrashService` (public interface), same pattern as `SitesModule`/`SystemModule` today.

Pages: unaffected by page_templates' `masterPageTemplateId` FK, which is already `ON DELETE SET NULL`; no change needed there. Deleting a page_templates row still enforced 409-if-referenced-by-a-page per spec 14 (not trashed while in use, to avoid restoring pages into a dangling state) — trash does not change that rule.

## 4. Web (admin)

New section **Trash** (Administration group, after Settings) at `/admin/trash`:

- List: entityType filter (Select: All + each covered type with a friendly label), Mantine Table (icon per type reusing `blockIconFor`-style mapping extended with type-specific icons, displayName, "Deleted" relative-ish date via `toLocaleString()`, deletedBy — resolve to email via a best-effort `GET /users/:id` per row, tolerate 404), row actions Restore (confirm optional, success notification) and Delete forever (confirm, red, explicit "cannot be undone"). Toolbar "Empty trash" (confirm modal, red, explicit item count).
- Empty state per spec 09 explaining the concept ("Deleted pages, blocks and other content stay here until you restore or permanently delete them. Sites are the only exception: deleting a site removes everything in it immediately.").
- Restore 409 (naming conflict) surfaces the API detail via notification, item stays in the list.

## Tests

- API unit: none beyond service logic covered by e2e (no complex pure functions here).
- API e2e: delete a page/block/content entry/object record/media file each lands in trash with the right entityType/displayName and disappears from its origin list endpoint; restore brings it back and it's gone from trash; restore with a live naming conflict returns 409 and the trash item remains; permanent delete removes it and (for a media file) its bytes from disk; deleting a content type or object definition WITH children no longer 409s, both parent and children appear in trash; deleting a site still cascades immediately and produces NO trash items; permission denied case; empty-trash purges everything for the tenant.
