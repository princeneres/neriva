# Spec 11: Documents and Media

Status: approved for implementation. A library of uploaded files (images, documents) organized in folders, with per-site default folders (Liferay: Documents and Media).

## Storage

- Physical storage is the local filesystem. Root directory from env `MEDIA_STORAGE_DIR` (default `./uploads` relative to apps/api cwd). Environment-level configuration like DATABASE_URL, never portal-editable.
- Files are stored under the root as `<2-char shard>/<uuid><ext>` (storageKey); the original filename lives only in the database. Max upload size 25 MB (413 above).
- Metadata in Postgres; no file bytes in the database.

## Data model

Table `media_folders` (standard envelope, no status/customFields):

| Column   | Type         | Rules                                                          |
| -------- | ------------ | -------------------------------------------------------------- |
| name     | varchar(255) | required                                                       |
| parentId | uuid         | nullable FK media_folders.id (cascade delete)                  |
| siteId   | uuid         | nullable FK sites.id (set null); marks a site's default folder |

Unique: `(tenant_id, external_reference_code)`; sibling name uniqueness `(tenant_id, parent_id, name)` NULLS NOT DISTINCT.

Table `media_files` (standard envelope + customFields):

| Column      | Type         | Rules                                      |
| ----------- | ------------ | ------------------------------------------ |
| folderId    | uuid         | nullable FK media_folders.id (null = root) |
| fileName    | varchar(255) | required, sanitized display name           |
| contentType | varchar(127) | required                                   |
| sizeBytes   | integer      | required                                   |
| storageKey  | varchar(255) | required, unique                           |
| alt         | varchar(500) | nullable (accessibility text for images)   |

## API

Permission resource: `media` (read/create/update/delete).

| Method | Path                        | Permission    | Notes                                                                                                                                                                                                                  |
| ------ | --------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | /media/folders              | media:read    | `?parent=<id                                                                                                                                                                                                           | root>` children listing           |
| POST   | /media/folders              | media:create  | name, parent?                                                                                                                                                                                                          |
| PATCH  | /media/folders/:id          | media:update  | rename, move (parent)                                                                                                                                                                                                  |
| DELETE | /media/folders/:id          | media:delete  | cascades to subfolders and files (bytes removed best-effort)                                                                                                                                                           |
| GET    | /media/files                | media:read    | `?folder=<id                                                                                                                                                                                                           | root>` listing, cursor pagination |
| POST   | /media/files                | media:create  | multipart (`file` field) + optional `folderId` or `site` ref fields; with `site` and no folder, the file lands in that site's default folder `Sites/<site name>` (auto-created, `siteId` set, ERC `site-media-<slug>`) |
| GET    | /media/files/:id            | media:read    | metadata incl. `url` (the public content URL)                                                                                                                                                                          |
| PATCH  | /media/files/:id            | media:update  | fileName, alt, folderId (move)                                                                                                                                                                                         |
| DELETE | /media/files/:id            | media:delete  | removes row + bytes                                                                                                                                                                                                    |
| GET    | /public/media/:id/:fileName | none (public) | streams the file bytes with its content type and long cache headers; :fileName is cosmetic (any value accepted); 404 when missing                                                                                      |

- Multipart via `@fastify/multipart` (new dependency, registered in main.ts/app setup).
- File responses include `url` computed as `/public/media/<id>/<urlencoded fileName>`.
- Upload sanitizes the display name (strip path separators/control chars) and rejects empty files.

## Tests

- Unit: name sanitization, storage key generation.
- e2e (Testcontainers + a temp dir as MEDIA_STORAGE_DIR): upload to root, upload with `site` creating the default folder (idempotent on second upload), metadata GET with url, public content GET streams the same bytes without auth, folder CRUD + sibling-name 409, move file, delete removes bytes from disk, permission denied for a role without media grants, 413 oversize (small limit override via env for the test if needed).

## Admin UI (section "Media" under Content in the sidebar)

- Folder browser: breadcrumb path, folder grid/list + files table or grid; images render thumbnails (the public URL), other types show an icon with the extension.
- Upload: button + drag-and-drop zone (@mantine/dropzone, new dependency) uploading to the CURRENT folder; when at root with a site selected in the global switcher, offer/default "Upload to <site> folder".
- File actions: copy public URL (clipboard + notification), rename, edit alt (images), move (folder select), delete (confirm).
- Folder actions: new folder, rename, delete (confirm explains cascade).
- HelpTips: what the library is for, what alt text does, per-site default folders.
