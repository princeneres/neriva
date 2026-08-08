# Spec 09: Admin UI v2 (design system and UX conventions)

Status: approved. Supersedes the visual conventions of spec 08 (the API-client rules there still apply). Goal: an admin a lay user can navigate without training, at the polish level of Strapi.

## Foundation (already implemented, MUST be reused)

- **Mantine v8** (`@mantine/core`, `@mantine/form`, `@mantine/notifications`, `@mantine/modals`) + `@tabler/icons-react`. Theme in `apps/web/lib/theme.ts`: primary `neriva` (red, #cc3d47 at shade 6), warm neutrals `slate`, display font Bricolage Grotesque (`--font-display`), body Instrument Sans, mono JetBrains Mono. Provider mounted in the root layout.
- `components/logo.tsx` (`NerivaLogo`, `BoltMark`) and `components/help-tip.tsx` (`HelpTip`).
- New AppShell layout (`app/admin/layout.tsx`) with grouped sidebar: Content (Sites, Pages, Content, Objects), Design (Blocks, Style Book), Administration (Users, Roles, Settings).
- `lib/api.ts` unchanged: `api.*`, `ApiError` (message = problem detail).

## Screen conventions

- **Page header**: `<Group justify="space-between" mb="lg">` with `<Title order={1} fz="h2">` + one-line `<Text c="slate.5">` subtitle explaining the concept in plain words, and the primary action as `<Button leftSection={<IconPlus size={16} />}>New ...</Button>`.
- **Help affordance**: every field or concept a lay user might not know gets `<HelpTip label="..."/>` next to its label (write labels as plain-language explanations, not restatements). Table column headers that need it too.
- **Lists**: Mantine `<Table highlightOnHover verticalSpacing="sm">` inside `<Card padding={0}>`. Skeleton rows while loading. Status as `<Badge color={...}>`: DRAFT gray, PUBLISHED green, ARCHIVED dark. ERC/paths/keys in `<Code>`. Dates via `toLocaleString()`. Row actions right-aligned: `<ActionIcon variant="subtle">` with Tooltip (IconPencil, IconTrash red, plus contextual ones); destructive actions use `modals.openConfirmModal` with a clear message, never `window.confirm`.
- **Empty states**: centered in the card: light `ThemeIcon` with the section icon, a one-liner explaining what the thing is for, and a CTA button. First-run experience matters: assume the user has never seen a CMS.
- **Feedback**: `notifications.show({ color: 'green' | 'red', ... })` for success/failure. Form-level errors as `<Alert color="red">`. Map problem `errors[]` entries to fields when possible (`@mantine/form` `setFieldError`).
- **Forms**: `@mantine/form` `useForm`. Create/edit as dedicated routes (keep existing paths). Inputs: `TextInput`, `Textarea`, `NumberInput`, `Switch` (booleans), `Select` (enums/relations), `TagsInput` (lists), `ColorInput` where a value is a color. Buttons: primary submit + subtle Cancel link back. Read-only metadata (id, ERC) in a muted `<Card>` aside or a small definition list, not disabled inputs.
- **Pagination**: keep `useCursorList`; render Load more as `<Button variant="light">` centered under the table.
- **Legacy cleanup**: while rebuilding a section, remove its usage of the old `.nv-*` classes and `components/data-table.tsx` `DataTable` (the hook `useCursorList` stays). Do not edit shared files.

## Language

All UI text in English, plain and friendly. Prefer "What is this?" explanations over jargon: e.g. Blocks list subtitle: "Blocks are the reusable pieces pages are made of. Each block declares which fields editors can fill in."

## Verification

Per section: `pnpm lint && pnpm typecheck && pnpm --filter @neriva/web build` green.
