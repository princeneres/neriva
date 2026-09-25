import { BadRequestException } from '@nestjs/common';
import { isValidIsoDate } from '../../common/iso-date';
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

// Size ceilings on a record payload. An Object field is metadata, not a
// document store, so these are far above any modelled value and still keep a
// single row from becoming a denial-of-service payload.
export interface RecordSizeLimits {
  maxTextLength: number;
  maxPayloadBytes: number;
}

// Applied to every caller, authenticated included.
export const DEFAULT_RECORD_SIZE_LIMITS: RecordSizeLimits = {
  maxTextLength: 10_000,
  maxPayloadBytes: 64 * 1024,
};

// Applied to anonymous writes, which have no account behind them to hold
// responsible; a public to-do item or comment fits comfortably.
export const PUBLIC_RECORD_SIZE_LIMITS: RecordSizeLimits = {
  maxTextLength: 1_000,
  maxPayloadBytes: 4 * 1024,
};

// Validates a record payload against the definition fields: unknown keys 400,
// missing required 400, type check, picklist membership, size ceilings
// (spec 05). null is accepted for optional fields and stored as provided.
export function validateRecordData(
  fields: ObjectFieldDefinition[],
  data: Record<string, unknown>,
  limits: RecordSizeLimits = DEFAULT_RECORD_SIZE_LIMITS,
): void {
  // Byte length, not character count: the column stores UTF-8 and a caller
  // padding with multi-byte characters must not buy extra room.
  const payloadBytes = Buffer.byteLength(JSON.stringify(data) ?? 'null', 'utf8');
  if (payloadBytes > limits.maxPayloadBytes) {
    bad(`Record payload is ${payloadBytes} bytes, over the ${limits.maxPayloadBytes} byte limit`);
  }

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
        if (value.length > limits.maxTextLength) {
          bad(`Field "${field.key}" is longer than ${limits.maxTextLength} characters`);
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
        // isValidIsoDate range-checks components; Date.parse would roll
        // impossible dates (2026-02-30) into the next month.
        if (
          typeof value !== 'string' ||
          !DATE_VALUE_PATTERN.test(value) ||
          !isValidIsoDate(value)
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
