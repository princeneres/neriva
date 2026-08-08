import { BadRequestException } from '@nestjs/common';
import {
  CONTENT_FIELD_TYPES,
  type ContentFieldDefinition,
  type ContentFieldType,
} from '../../db/schema';

export const FIELD_KEY_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

// ISO 8601: date-only, or date-time with optional seconds, fractional
// seconds and UTC/offset designator.
const ISO_8601_PATTERN =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})?)?$/;

// Component range checks on top of the shape regex. Date.parse cannot be
// trusted here: V8 rolls impossible calendar dates (2026-02-30) over into
// the next month instead of rejecting them.
export function isValidIsoDate(value: string): boolean {
  const match = ISO_8601_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12) {
    return false;
  }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) {
    return false;
  }
  const [, timePart, secondsPart] = match;
  if (timePart !== undefined) {
    const hour = Number(value.slice(11, 13));
    const minute = Number(value.slice(14, 16));
    if (hour > 23 || minute > 59) {
      return false;
    }
    if (secondsPart !== undefined && Number(value.slice(17, 19)) > 59) {
      return false;
    }
  }
  return true;
}

// Field definition as accepted on the wire: `required` defaults to false
// (spec 04).
export interface ContentFieldInput {
  key: string;
  label: string;
  type: ContentFieldType;
  required?: boolean;
}

function bad(detail: string): never {
  throw new BadRequestException({ detail });
}

// Cross-field rules the class-validator DTOs cannot express (key uniqueness)
// plus normalization of the `required` default. Shape rules are re-checked so
// the function stands on its own (unit tests, future callers).
export function normalizeContentTypeFields(fields: ContentFieldInput[]): ContentFieldDefinition[] {
  const seen = new Set<string>();
  return fields.map((field) => {
    if (typeof field.key !== 'string' || !FIELD_KEY_PATTERN.test(field.key)) {
      bad(`Invalid field key "${String(field.key)}": must match ${FIELD_KEY_PATTERN.source}`);
    }
    if (seen.has(field.key)) {
      bad(`Duplicate field key "${field.key}"`);
    }
    seen.add(field.key);
    if (typeof field.label !== 'string' || field.label.length === 0) {
      bad(`Field "${field.key}" requires a non-empty label`);
    }
    if (!CONTENT_FIELD_TYPES.includes(field.type)) {
      bad(`Field "${field.key}" has unknown type "${String(field.type)}"`);
    }
    if (field.required !== undefined && typeof field.required !== 'boolean') {
      bad(`Field "${field.key}" has a non-boolean "required" flag`);
    }
    return {
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required ?? false,
    };
  });
}

// Validates an entry values payload against the content type fields: unknown
// keys 400, missing required 400, wrong primitive type 400 (spec 04).
// null is accepted for optional fields and stored as provided.
export function validateEntryValues(
  fields: ContentFieldDefinition[],
  values: Record<string, unknown>,
): void {
  const known = new Set(fields.map((field) => field.key));
  const unknown = Object.keys(values).filter((key) => !known.has(key));
  if (unknown.length > 0) {
    bad(`Unknown field key(s): ${unknown.join(', ')}`);
  }

  for (const field of fields) {
    const value = values[field.key];
    if (value === undefined || value === null) {
      if (field.required) {
        bad(`Field "${field.key}" is required`);
      }
      continue;
    }
    switch (field.type) {
      case 'text':
      case 'richtext':
        if (typeof value !== 'string') {
          bad(`Field "${field.key}" must be a string`);
        }
        break;
      case 'number':
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          bad(`Field "${field.key}" must be a finite number`);
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          bad(`Field "${field.key}" must be a boolean`);
        }
        break;
      case 'date':
        if (typeof value !== 'string' || !isValidIsoDate(value)) {
          bad(`Field "${field.key}" must be a valid ISO 8601 date string`);
        }
        break;
    }
  }
}
