import type { components } from '@neriva/contracts';

export type BlockSlot = components['schemas']['BlockSlotDto'];

// The generator types nullable columns as objects (OpenAPI "type: [x, null]"
// quirk); at runtime the API returns plain strings. Refine locally.
export type Block = Omit<
  components['schemas']['BlockDto'],
  'category' | 'description' | 'createdBy'
> & {
  category: string | null;
  description: string | null;
  createdBy: string | null;
};

export interface BlockPayload {
  name: string;
  category?: string;
  description?: string;
  propsSchema: Record<string, unknown>;
  slots: BlockSlot[];
}

export type BuilderFieldType = 'text' | 'longtext' | 'number' | 'boolean' | 'choice';

export interface BuilderField {
  key: string;
  label: string;
  type: BuilderFieldType;
  options: string[];
  required: boolean;
}

export const FIELD_TYPE_OPTIONS: { value: BuilderFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'longtext', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'choice', label: 'Choice' },
];

export const CATEGORY_SUGGESTIONS = ['layout', 'content', 'media', 'navigation'];

export const SLOT_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Compiles builder rows into the JSON Schema stored as propsSchema.
// "Long text" is marked with format: "multiline" so it round-trips.
export function fieldsToSchema(fields: BuilderField[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const field of fields) {
    const key = field.key.trim();
    const property: Record<string, unknown> = {};
    switch (field.type) {
      case 'text':
        property.type = 'string';
        break;
      case 'longtext':
        property.type = 'string';
        property.format = 'multiline';
        break;
      case 'number':
        property.type = 'number';
        break;
      case 'boolean':
        property.type = 'boolean';
        break;
      case 'choice':
        property.type = 'string';
        property.enum = [...field.options];
        break;
    }
    if (field.label.trim()) {
      property.title = field.label.trim();
    }
    properties[key] = property;
    if (field.required) {
      required.push(key);
    }
  }
  const schema: Record<string, unknown> = { type: 'object', properties };
  if (required.length > 0) {
    schema.required = required;
  }
  schema.additionalProperties = false;
  return schema;
}

const BUILDER_TOP_KEYS = new Set(['type', 'properties', 'required', 'additionalProperties']);
const BUILDER_PROPERTY_KEYS = new Set(['type', 'title', 'format', 'enum']);

// Inverse of fieldsToSchema. Returns null when the schema uses anything the
// builder cannot represent, which sends the form into advanced mode.
export function schemaToFields(schema: unknown): BuilderField[] | null {
  if (!isPlainObject(schema)) {
    return null;
  }
  if (Object.keys(schema).some((key) => !BUILDER_TOP_KEYS.has(key))) {
    return null;
  }
  if (schema.type !== 'object' || schema.additionalProperties !== false) {
    return null;
  }
  const properties = schema.properties;
  if (!isPlainObject(properties)) {
    return null;
  }
  const rawRequired = schema.required === undefined ? [] : schema.required;
  if (
    !Array.isArray(rawRequired) ||
    !rawRequired.every((entry): entry is string => typeof entry === 'string')
  ) {
    return null;
  }
  if (rawRequired.some((key) => !(key in properties))) {
    return null;
  }
  const fields: BuilderField[] = [];
  for (const [key, raw] of Object.entries(properties)) {
    if (!isPlainObject(raw)) {
      return null;
    }
    if (Object.keys(raw).some((k) => !BUILDER_PROPERTY_KEYS.has(k))) {
      return null;
    }
    if (raw.title !== undefined && typeof raw.title !== 'string') {
      return null;
    }
    const label = typeof raw.title === 'string' ? raw.title : '';
    let type: BuilderFieldType;
    let options: string[] = [];
    if (raw.enum !== undefined) {
      if (
        raw.type !== 'string' ||
        raw.format !== undefined ||
        !Array.isArray(raw.enum) ||
        raw.enum.length === 0 ||
        !raw.enum.every((option): option is string => typeof option === 'string')
      ) {
        return null;
      }
      type = 'choice';
      options = [...raw.enum];
    } else if (raw.type === 'string' && raw.format === 'multiline') {
      type = 'longtext';
    } else if (raw.type === 'string' && raw.format === undefined) {
      type = 'text';
    } else if (raw.type === 'number' && raw.format === undefined) {
      type = 'number';
    } else if (raw.type === 'boolean' && raw.format === undefined) {
      type = 'boolean';
    } else {
      return null;
    }
    fields.push({ key, label, type, options, required: rawRequired.includes(key) });
  }
  return fields;
}
