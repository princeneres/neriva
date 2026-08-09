import {
  IconCube,
  IconDatabase,
  IconFileText,
  IconFolder,
  IconLayoutBoard,
  IconPalette,
  IconPhoto,
  type Icon,
} from '@tabler/icons-react';

// Entity types covered by the trash (spec 15 section 1). Sites, users, roles,
// system settings and tenants are deleted immediately and never land here.
export type TrashEntityType =
  | 'pages'
  | 'blocks'
  | 'page_templates'
  | 'content_types'
  | 'content_entries'
  | 'object_definitions'
  | 'object_records'
  | 'style_books'
  | 'media_folders'
  | 'media_files';

// List shape returned by GET /trash (spec 15 section 2). GET /trash/:id adds
// `payload`, but the list screen never needs the full snapshotted row.
export interface TrashItem {
  id: string;
  entityType: TrashEntityType;
  entityId: string;
  displayName: string;
  deletedAt: string;
  deletedBy: string | null;
}

// Friendly label + icon per covered entity type, in the order shown in the
// filter dropdown and matching the icon-mapping spirit of block-icon.tsx.
export const TRASH_ENTITY_TYPES: { value: TrashEntityType; label: string; icon: Icon }[] = [
  { value: 'pages', label: 'Page', icon: IconFileText },
  { value: 'blocks', label: 'Block', icon: IconCube },
  { value: 'page_templates', label: 'Page template', icon: IconLayoutBoard },
  { value: 'content_types', label: 'Content type', icon: IconFileText },
  { value: 'content_entries', label: 'Content entry', icon: IconFileText },
  { value: 'object_definitions', label: 'Object definition', icon: IconDatabase },
  { value: 'object_records', label: 'Object record', icon: IconDatabase },
  { value: 'style_books', label: 'Style book', icon: IconPalette },
  { value: 'media_folders', label: 'Media folder', icon: IconFolder },
  { value: 'media_files', label: 'Media file', icon: IconPhoto },
];

const LABEL_BY_TYPE = new Map<string, string>(
  TRASH_ENTITY_TYPES.map((entry) => [entry.value, entry.label]),
);
const ICON_BY_TYPE = new Map<string, Icon>(
  TRASH_ENTITY_TYPES.map((entry) => [entry.value, entry.icon]),
);

export function trashTypeLabel(entityType: string): string {
  return LABEL_BY_TYPE.get(entityType) ?? entityType;
}

export function trashIconFor(entityType: string): Icon {
  return ICON_BY_TYPE.get(entityType) ?? IconFileText;
}

export const TRASH_HELP =
  'Deleted pages, blocks and other content stay here until you restore or permanently delete them';
