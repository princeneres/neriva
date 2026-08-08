# Spec 08: Admin UI conventions (Phase C)

Status: approved. Applies to every admin screen in apps/web. The rendering runtime is NOT part of Phase C.

## Principles

- The Admin UI is just another API client: everything goes through the public REST API with the generated types from @neriva/contracts. No server-side data access, no admin backdoors.
- No new runtime dependencies. React + Next.js + the shared helpers below. No component library, no fetch library, no form library.
- Screens are client components (the skeleton stores tokens in localStorage; a cookie proxy is a later phase).

## Shared foundation (already implemented, do not duplicate)

- `lib/api.ts`: typed `api.get/post/patch/put/del`, single-flight automatic token refresh on 401, `ApiError` carrying the RFC 7807 problem
- `lib/auth-storage.ts`: token persistence
- `components/toast.tsx`: `ToastProvider` + `useToast()` (`toast.success(msg)` / `toast.error(msg)`); the provider is mounted in the admin layout
- `components/data-table.tsx`: `DataTable<T>` (typed columns, empty state, row actions) and `useCursorList<T>` (cursor pagination with a Load more button via `listMore`)
- `components/form.tsx`: `Field` (label + input/children + error), `Button` (`variant: primary | secondary | danger`), `FormActions`
- globals.css: `.nv-table`, `.nv-toolbar`, `.nv-card`, `.nv-badge`, `.nv-toast*`, button variants; use these classes, do not invent parallel styling

## Screen conventions

- Routes: list at `app/admin/<section>/page.tsx`, create at `.../new/page.tsx`, edit at `.../[id]/page.tsx`. The catch-all placeholder `app/admin/[section]/page.tsx` stays for unbuilt sections; static routes take precedence.
- List screens: toolbar with title + primary action ("New <thing>"), DataTable, cursor pagination via `useCursorList`, per-row Edit/Delete actions.
- Deletes: `window.confirm` then `api.del`, then `toast.success` and list refresh. On `ApiError`, `toast.error(error.message)` (the problem `detail` is already the message).
- Forms: controlled inputs with `Field`, submit disables the button, `ApiError` shows as an inline error box (`.nv-error`) plus per-field mapping when the problem `errors` array names a field.
- Permission failures (403) are normal states: show the toast, never crash. 401 after auto-refresh means logged out: `clearTokens()` + redirect to /login (the layout already guards on mount).
- Dates: render with `new Date(value).toLocaleString()`. Status: render with `.nv-badge` (`data-status` attribute drives the color).
- All UI text in English.

## Verification

Per screen: `pnpm lint && pnpm typecheck && pnpm build` green (web has no e2e infra in this phase; unit-test pure logic with vitest when a screen extracts any non-trivial helper). Manual flow check via the running stack when possible.
