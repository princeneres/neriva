# Spec 16: Shared Resource Folders

Status: implemented. Folders organize authoring resources for every user in a tenant.

## 1. Scope

Folders are available for blocks, content types, content entries, and object definitions. A folder belongs to exactly one resource family, so a block folder cannot be assigned to an Object or a content entry. Items may remain in the root by leaving `folderId` null.

Folders are shared tenant data, not browser-local preferences. Deleting a folder keeps its items and moves them back to the root through `ON DELETE SET NULL`.

## 2. Data model

`resource_folders` uses the standard entity envelope plus:

- `name`, required and limited to 255 characters;
- `resource`, one of `blocks`, `content-types`, `content-entries`, or `objects`.

Folder names are unique within a tenant and resource family. Resource tables expose a nullable `folder_id` with an index for tenant-scoped folder queries.

## 3. API

Permission resource: `resource-folder` with `read`, `create`, `update`, and `delete` actions.

| Method | Path                    | Notes                                         |
| ------ | ----------------------- | --------------------------------------------- |
| GET    | `/resource-folders`     | Cursor pagination, optional `resource` filter |
| GET    | `/resource-folders/:id` | UUID or `erc:<externalReferenceCode>`         |
| POST   | `/resource-folders`     | Creates a shared folder                       |
| PATCH  | `/resource-folders/:id` | Renames a folder                              |
| DELETE | `/resource-folders/:id` | Deletes the folder and clears assignments     |

Resource list endpoints accept `folder=<uuid-or-erc>` where supported. Create and update DTOs accept `folderId`; the API validates that the referenced folder belongs to the same tenant and resource family.

## 4. Admin UI

Blocks, content types, content entries, and object definitions expose a shared folder panel, folder filtering, and an inline folder picker. Search and sort controls remain available alongside the folder filter. Folder selection is sent to the API, so the same organization is visible to all users and sessions.
