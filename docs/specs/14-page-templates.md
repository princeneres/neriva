# Spec 14: Page templates and Master Pages

Status: approved for implementation. Liferay equivalent: Page Templates + Master Page Templates. A Master Page defines the header/footer every page renders inside; a (non-master) Page Template is a pre-filled starting point copied into a new page.

## 1. Data model (API)

New table `page_templates` (standard envelope, no status/customFields):

| Column | Type                                            | Rules                                                                                             |
| ------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| name   | varchar(255)                                    | required, unique per tenant                                                                       |
| kind   | enum `page_template_kind`: `MASTER`, `STANDARD` | required                                                                                          |
| siteId | uuid                                            | nullable FK sites.id (set null); null = available to every site, set = offered only for that site |
| tree   | jsonb                                           | same `PageTree` shape as `pages.tree` (spec 03); default `{ blocks: [] }`                         |

Unique: `(tenant_id, external_reference_code)`.

### The drop zone (MASTER only)

A reserved pseudo-block ERC `__page_content__` marks where a page's own content renders inside the master. It is not a row in `blocks`; the tree validator and renderer special-case it.

- A `MASTER` template's tree must contain the drop zone node (`{ "block": "__page_content__" }`) exactly once, anywhere in the tree (root or nested in a slot). Zero or more than one occurrence: 400 `"a master page must contain exactly one page-content drop zone"`.
- A `STANDARD` template's tree must NOT contain the drop zone: 400 if it does.
- The drop zone node accepts no `props`/`slots`/`styles`; violations 400.
- Every other node in a MASTER or STANDARD tree is validated exactly like a page tree (spec 03: block exists, props match schema, slots declared) except the drop zone exception above.

### Pages gain a master

`pages` table: nullable `masterPageTemplateId` (uuid, FK `page_templates.id`, set null on template delete). Resolution order when rendering or publishing: page's own `masterPageTemplateId` -> tenant setting `page.default-master-template` (an ERC, new well-known system setting; kebab-cased to satisfy spec 07's key pattern `^[a-z][a-z0-9.-]*$`) -> the single MASTER template with the lowest `createdAt` -> no master (page tree renders standalone, unchanged v1 behavior). Setting a page's master to a non-MASTER template, or to a template scoped to a different site, is 400.

### Composition

A pure function (shared by delivery and any other server-side render path), given `masterTree` and `pageTree`, returns one `PageTree` with the drop-zone node replaced by `pageTree.blocks` spliced in place. No master resolved: the page's own tree is returned unchanged.

## 2. API surface

Permission resource: `page-template` (read/create/update/delete). Publishing does not apply (templates aren't a lifecycle; they are always "live" the moment they validate).

| Method | Path                | Permission           | Notes                                                                                                |
| ------ | ------------------- | -------------------- | ---------------------------------------------------------------------------------------------------- |
| GET    | /page-templates     | page-template:read   | cursor pagination; `?kind=MASTER\|STANDARD` filter                                                   |
| GET    | /page-templates/:id | page-template:read   | UUID or `erc:<code>`                                                                                 |
| POST   | /page-templates     | page-template:create | 201; tree defaults to `{blocks:[]}` for STANDARD, to a single drop-zone node for MASTER when omitted |
| PATCH  | /page-templates/:id | page-template:update | name, tree (re-validated per kind)                                                                   |
| DELETE | /page-templates/:id | page-template:delete | 409 if any page currently sets it as `masterPageTemplateId`                                          |

Pages API additions (spec 03 amendment):

- `POST /sites/:siteRef/pages` and `PATCH /pages/:id` accept optional `masterPageTemplateId` (ref: UUID or `erc:`) and optional `templateId` on CREATE ONLY (a STANDARD template ref whose `tree` is copied as the initial `tree`; not persisted as a relationship).
- `GET /pages/:id` response includes the resolved `masterPageTemplateId` actually in effect (the page's own value, or null when falling back to the tenant default — the client resolves the default separately via `GET /page-templates?kind=MASTER` if it needs to show which one applies).
- Delivery (`GET /public/sites/:slug/page`): the returned `page.tree` is the COMPOSED tree (master + page spliced); add the resolved master's blocks referenced (union with the page's own) to the `blocks` map so the renderer has every ERC it needs. Update spec 10 accordingly.

## 3. Seed

Extend the native seed (`NativeMasterPageSeedService`, registered in `DbModule`, idempotent by ERC, gated by `SEED_NATIVE_BLOCKS !== 'false'`):

- MASTER template erc `master-default`, name "Default Master": header (`nv-container` with an `nv-heading` reading the tenant name placeholder "Your Site" and an `nv-paragraph` byline), the drop zone, footer (`nv-container` with an `nv-paragraph` "© <year> · Built with Neriva"). Real, presentable output, not a stub.
- STANDARD template erc `template-blank`, name "Blank page": empty tree.
- System setting `page.default-master-template` = `master-default` seeded alongside (idempotent upsert-if-absent).

The three chrome blocks the default master references (`nv-container`, `nv-heading`, `nv-paragraph`) are seeded by this same service so the default master seeds independently of any other block catalog.

## 4. Web (admin)

New section **Page Templates** (Design group, after Style Book) at `/admin/page-templates`:

- Gallery like Blocks (spec 02 UI precedent): cards grouped by kind (Masters first, then Templates), name, block-count summary, a "Master" badge on MASTER cards, Edit/Duplicate/Delete actions (delete blocked with the API's 409 detail shown when in use).
- Editor screen: reuse the pure tree-editing primitives from `apps/web/app/admin/pages/` rather than rebuilding them — this is a lighter editor than the full Page Studio (no Publish/View/device-preview toolbar, no per-page settings): a canvas + palette + inspector for props, a Save button, and for MASTER kind the drop zone renders as a fixed, non-removable, dashed placeholder card ("Page content renders here") that can be reordered among its siblings but never deleted and never expanded for editing; the palette gets an extra always-visible "Page content" item (only insertable once; disabled/hidden once already present) so authors can place it.
- Page settings screen gains a "Master page" Select (options from `GET /page-templates?kind=MASTER`, plus "Use the site default"); new-page creation form gains an optional "Start from a template" Select (`GET /page-templates?kind=STANDARD`).

## Tests

- API unit: drop-zone count validation (0/1/2+), STANDARD-must-not-contain-it, composition function (splice at root, splice inside a nested slot, no master = passthrough).
- API e2e: template CRUD per kind, page create with `templateId` copies tree once (no ongoing link), page master resolution order (explicit -> setting -> oldest MASTER -> none), delivery response contains the composed tree and the master's block ERCs in the map, delete a MASTER in use -> 409, permission denied case.
