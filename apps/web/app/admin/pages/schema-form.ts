// Pure helpers turning a block propsSchema (JSON Schema draft 2020-12) into
// flat field specs the visual editor renders as regular form inputs. Shapes
// the mapping cannot express fall back to a JSON field for that prop only.

import { isPlainObject } from './tree-utils';

export type PropFieldKind = 'text' | 'textarea' | 'number' | 'boolean' | 'enum' | 'json';

export interface PropFieldSpec {
  name: string;
  kind: PropFieldKind;
  label: string;
  description: string | null;
  required: boolean;
  enumValues: (string | number)[];
}

const LONG_TEXT_FORMATS = new Set(['textarea', 'multiline', 'markdown', 'html', 'long-text']);

export function fieldSpecsFor(propsSchema: Record<string, unknown>): PropFieldSpec[] {
  const properties = isPlainObject(propsSchema.properties) ? propsSchema.properties : {};
  const required = Array.isArray(propsSchema.required)
    ? propsSchema.required.filter((entry): entry is string => typeof entry === 'string')
    : [];
  return Object.entries(properties).map(([name, schema]) =>
    buildSpec(name, schema, required.includes(name)),
  );
}

function buildSpec(name: string, schema: unknown, required: boolean): PropFieldSpec {
  const base: PropFieldSpec = {
    name,
    kind: 'json',
    label: name,
    description: null,
    required,
    enumValues: [],
  };
  if (!isPlainObject(schema)) {
    return base;
  }
  const spec: PropFieldSpec = {
    ...base,
    label: typeof schema.title === 'string' ? schema.title : name,
    description: typeof schema.description === 'string' ? schema.description : null,
  };
  if (Array.isArray(schema.enum)) {
    const values = schema.enum;
    const supported =
      values.length > 0 &&
      values.every(
        (value): value is string | number => typeof value === 'string' || typeof value === 'number',
      );
    return supported ? { ...spec, kind: 'enum', enumValues: values } : spec;
  }
  switch (schema.type) {
    case 'string': {
      const longByFormat =
        typeof schema.format === 'string' && LONG_TEXT_FORMATS.has(schema.format);
      const longByLength = typeof schema.maxLength === 'number' && schema.maxLength > 120;
      return { ...spec, kind: longByFormat || longByLength ? 'textarea' : 'text' };
    }
    case 'number':
    case 'integer':
      return { ...spec, kind: 'number' };
    case 'boolean':
      return { ...spec, kind: 'boolean' };
    default:
      return spec;
  }
}
