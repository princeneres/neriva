# Spec 13: Site-first navigation

Status: approved for implementation. The public site is the front door; the admin is reached from it, not the other way around.

## Default site

- New well-known system setting `site.default` holding a site slug. Resolution order: setting value (if the slug exists) -> oldest site (first created) -> none.
- Delivery API gains `GET /public/site` (@Public): `{ data: { name, slug } }` of the default site, 404 when no sites exist.

## Web routing

- `/` and `/<path>` (catch-all, excluding the reserved prefixes /admin, /login, /change-password, /s, /_next, /api) render the DEFAULT site's published page at that path, exactly like `/s/<slug>/<path>` does (shared implementation). Root with no default site or no published home renders a friendly welcome page whose CTA links to `/admin/sites` ("Neriva is running. Sign in to build your site."): `/admin` itself is a bare redirect back to `/` (see below), so pointing the CTA there would bounce an authenticated user with zero sites right back to this same screen.
- `/s/<slug>/...` stays for addressing any site explicitly.
- The old `/` -> /admin|/login redirect is removed.
- `/admin` renders no dashboard of its own: it is a server-side `redirect('/')`, kept only so bookmarks and old links resolve instead of 404ing. It carries no auth check of its own (redirecting to the public home needs none); every real admin screen still sits behind `/admin/*` and the existing auth-gated layout.

## The front door is seeded content, not admin UI

The welcome and "how Neriva fits together" material that used to live on a standalone `/admin` dashboard now lives as ordinary page/block data: the DEFAULT site's home page (`DEMO_PAGE_TREE` in `apps/api/src/db/demo-seed.service.ts`), seeded like any other page. It is built from the native `nv-*` library rather than the minimal demo blocks, so it looks like something a user would build and reading its tree teaches the blocks they will actually use. It covers every v1 capability (Sites, Pages, Blocks, Content, Objects, Media, Style Book) and sends the reader to two companion demo pages seeded on the same site, each a working feature rather than a description of one:

- `/blog`: the Article content type and its six seeded posts, listed by the `nv-post-list` block with search and cursor pagination over the public delivery API. Each post carries a `thumbnail` field holding the URL of a seeded media file, which is how the media library is demonstrated: in context, on real content, instead of on a page of its own.
- `/todo`: a working to do list over the "Task" Object definition, rendered by the `nv-todo-list` block, which reads and writes real records through the authenticated Objects API. The page then documents how it was built and names the exact endpoints it calls.

There is deliberately no standalone `/media` page: a folder listing taught nothing that the blog thumbnails do not teach better. The `Demo Media` folder and its files are still seeded, and remain browsable at `/admin/media`.

Because this is regular seeded content, it needs no special-casing in the renderer and is fully editable/deletable through the same admin screens and REST endpoints as any other page.

## Admin bridge

- Public pages render a small floating pill (bottom-right, client component) ONLY when an access token exists in localStorage: "Neriva" bolt icon with links "Edit this page" (studio URL of that page, resolved via the admin API by site slug + path; if the lookup fails, link to /admin/pages) and "Admin". Invisible for anonymous visitors.
- Admin sidebar site switcher: "Visit site" opens `/` when the chosen site IS the default, else `/s/<slug>`; switching sites keeps you in the admin (no navigation), but the Visit link always reflects the current choice.
- The admin sidebar logo links to `/` (the real front door), not `/admin`. The user menu's "Go to admin" item (shown on public site pages) links to `/admin/pages`, a concrete destination, since `/admin` itself is now just a redirect back to where that menu already is.

## Tests

- API e2e: default-site resolution order (setting wins, fallback oldest), /public/site 404 with no sites.
- API e2e: demo seed covers the home page plus the blog and to do pages, that the site has exactly those three paths, the Article type including its thumbnail field, the six posts and that each thumbnail resolves to a media file whose bytes `/public/media` really serves, and the Task object with its records (`apps/api/test/demo-seed.e2e-spec.ts`).
- Web: pure path-exclusion helper unit-tested in lib/.
