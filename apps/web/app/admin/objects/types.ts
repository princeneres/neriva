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

export const OBJECTS_HELP = 'Your own data tables, like Products or Leads, defined without code';
