import type { components } from '@neriva/contracts';

export type ObjectField = components['schemas']['ObjectFieldDto'];
export type ObjectFieldType = ObjectField['type'];
export type ObjectRecord = components['schemas']['ObjectRecordDto'];

// The generated ObjectDefinitionDto types nullable text columns as objects
// (OpenAPI "type: [object, null]" quirk); at runtime the API returns plain
// strings (spec 05: description is nullable text). Refine locally.
export type ObjectDefinition = Omit<components['schemas']['ObjectDefinitionDto'], 'description'> & {
  description: string | null;
};

// Friendly names shown in the UI for each field type.
export const FIELD_TYPE_OPTIONS: { value: ObjectFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Yes/No' },
  { value: 'date', label: 'Date' },
  { value: 'picklist', label: 'Choice list' },
];

export function fieldTypeLabel(type: ObjectFieldType): string {
  return FIELD_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

export const FIELD_KEY_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

// Anonymous access ladder (spec 05). Every object starts at "none"; opening
// one up is always an explicit choice made on this screen.
export type ObjectPublicAccess = 'none' | 'read' | 'read-write';

export const PUBLIC_ACCESS_OPTIONS: {
  value: ObjectPublicAccess;
  label: string;
  description: string;
}[] = [
  {
    value: 'none',
    label: 'Private',
    description:
      'Only signed-in people with permission can see or change these records. This is the default.',
  },
  {
    value: 'read',
    label: 'Anyone can read',
    description:
      'Visitors who are not signed in can list these records on your website. They cannot add, change or delete anything.',
  },
  {
    value: 'read-write',
    label: 'Anyone can read and write',
    description:
      'Visitors who are not signed in can add records, and can change or delete any record, including ones other visitors added. Use it for a shared list, never for anything private.',
  },
];

export function publicAccessLabel(mode: ObjectPublicAccess): string {
  return PUBLIC_ACCESS_OPTIONS.find((option) => option.value === mode)?.label ?? mode;
}

export const OBJECTS_HELP = 'Your own data tables, like Products or Leads, defined without code';
