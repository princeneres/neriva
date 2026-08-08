import { BadRequestException } from '@nestjs/common';
import { OBJECT_FIELD_TYPES, type ObjectFieldDefinition } from '../../db/schema';

export const FIELD_KEY_PATTERN = /^[a-z][a-zA-Z0-9]*$/;
const DATE_VALUE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function bad(detail: string): never {
  throw new BadRequestException({ detail });
}

// Cross-field rules the class-validator DTOs cannot express: key uniqueness
// and the picklist/options pairing. Shape rules are re-checked so the
// function stands on its own (unit tests, future callers).
export function validateDefinitionFields(fields: ObjectFieldDefinition[]): void {
  const seen = new Set<string>();
  for (const field of fields) {
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
    if (!OBJECT_FIELD_TYPES.includes(field.type)) {
      bad(`Field "${field.key}" has unknown type "${String(field.type)}"`);
    }
    if (typeof field.required !== 'boolean') {
      bad(`Field "${field.key}" requires a boolean "required" flag`);
    }
    if (field.type === 'picklist') {
      if (!Array.isArray(field.options) || field.options.length === 0) {
        bad(`Picklist field "${field.key}" requires a non-empty options array`);
      }
      if (field.options.some((option) => typeof option !== 'string' || option.length === 0)) {
        bad(`Picklist field "${field.key}" options must be non-empty strings`);
      }
      if (new Set(field.options).size !== field.options.length) {
        bad(`Picklist field "${field.key}" has duplicate options`);
      }
    } else if (field.options !== undefined) {
      bad(`Field "${field.key}" of type ${field.type} must not declare options`);
    }
  }
}

// Validates a record payload against the definition fields: unknown keys 400,
// missing required 400, type check, picklist membership (spec 05).
// null is accepted for optional fields and stored as provided.
export function validateRecordData(
  fields: ObjectFieldDefinition[],
  data: Record<string, unknown>,
): void {
  const known = new Set(fields.map((field) => field.key));
  const unknown = Object.keys(data).filter((key) => !known.has(key));
  if (unknown.length > 0) {
    bad(`Unknown field key(s): ${unknown.join(', ')}`);
  }

  for (const field of fields) {
    const value = data[field.key];
    if (value === undefined || value === null) {
      if (field.required) {
        bad(`Field "${field.key}" is required`);
      }
      continue;
    }
    switch (field.type) {
      case 'text':
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
        if (
          typeof value !== 'string' ||
          !DATE_VALUE_PATTERN.test(value) ||
          Number.isNaN(Date.parse(value))
        ) {
          bad(`Field "${field.key}" must be a date string (YYYY-MM-DD)`);
        }
        break;
      case 'picklist':
        if (typeof value !== 'string' || !(field.options ?? []).includes(value)) {
          bad(`Field "${field.key}" must be one of: ${(field.options ?? []).join(', ')}`);
        }
        break;
    }
  }
}
