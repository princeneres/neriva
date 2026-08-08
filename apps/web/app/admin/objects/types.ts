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

export const FIELD_TYPES: ObjectFieldType[] = ['text', 'number', 'boolean', 'date', 'picklist'];

export const FIELD_KEY_PATTERN = /^[a-z][a-zA-Z0-9]*$/;
