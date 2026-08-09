# Spec 13: Site-first navigation

Status: approved for implementation. The public site is the front door; the admin is reached from it, not the other way around.

## Default site

- New well-known system setting `site.default` holding a site slug. Resolution order: setting value (if the slug exists) -> oldest site (first created) -> none.
- Delivery API gains `GET /public/site` (@Public): `{ data: { name, slug } }` of the default site, 404 when no sites exist.

## Web routing

- `/` and `/<path>` (catch-all, excluding the reserved prefixes /admin, /login, /change-password, /s, /_next, /api) render the DEFAULT site's published page at that path, exactly like `/s/<slug>/<path>` does (shared implementation). Root with no default site or no published home renders a friendly welcome page linking to /admin ("Neriva is running. Sign in to build your site.").
- `/s/<slug>/...` stays for addressing any site explicitly.
- The old `/` -> /admin|/login redirect is removed; /admin remains the admin entry and still guards auth.

## Admin bridge

- Public pages render a small floating pill (bottom-right, client component) ONLY when an access token exists in localStorage: "Neriva" bolt icon with links "Edit this page" (studio URL of that page, resolved via the admin API by site slug + path; if the lookup fails, link to /admin/pages) and "Admin". Invisible for anonymous visitors.
- Admin sidebar site switcher: "Visit site" opens `/` when the chosen site IS the default, else `/s/<slug>`; switching sites keeps you in the admin (no navigation), but the Visit link always reflects the current choice.
- Dashboard quick actions gain a "View your site" card linking to the default site home.

## Tests

- API e2e: default-site resolution order (setting wins, fallback oldest), /public/site 404 with no sites.
- Web: pure path-exclusion helper unit-tested in lib/.
