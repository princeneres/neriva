import { BadRequestException } from '@nestjs/common';
import type { ObjectFieldDefinition } from '../../db/schema';

const FILTER_PARAM_PATTERN = /^filter\[([^\]]*)\]$/;

export type FilterValue = string | number | boolean;

export interface RecordFilter {
  field: ObjectFieldDefinition;
  value: FilterValue;
}

export interface RecordSort {
  field: ObjectFieldDefinition;
  direction: 'asc' | 'desc';
}

function bad(detail: string): never {
  throw new BadRequestException({ detail });
}

// Extracts filter[<fieldKey>]=<value> equality filters from the raw query
// string (spec 05). Multiple filters are ANDed by the caller. Values are
// coerced by the field type; unknown field keys are a 400.
export function parseRecordFilters(
  query: Record<string, unknown>,
  fields: ObjectFieldDefinition[],
): RecordFilter[] {
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const filters: RecordFilter[] = [];
  for (const [param, raw] of Object.entries(query)) {
    const match = FILTER_PARAM_PATTERN.exec(param);
    if (!match) {
      continue;
    }
    const fieldKey = match[1]!;
    const field = byKey.get(fieldKey);
    if (!field) {
      bad(`Unknown filter field "${fieldKey}"`);
    }
    // A repeated query parameter arrives as an array; each occurrence is an
    // independent (ANDed) equality filter.
    const values = Array.isArray(raw) ? raw : [raw];
    for (const value of values) {
      if (typeof value !== 'string') {
        bad(`Filter "${fieldKey}" must be a plain value`);
      }
      filters.push({ field, value: coerceFilterValue(field, value) });
    }
  }
  return filters;
}

function coerceFilterValue(field: ObjectFieldDefinition, value: string): FilterValue {
  switch (field.type) {
    case 'number': {
      const parsed = Number(value);
      if (value.trim() === '' || !Number.isFinite(parsed)) {
        bad(`Filter "${field.key}" expects a number, got "${value}"`);
      }
      return parsed;
    }
    case 'boolean':
      if (value === 'true') {
        return true;
      }
      if (value === 'false') {
        return false;
      }
      bad(`Filter "${field.key}" expects true or false, got "${value}"`);
      break;
    default:
      return value;
  }
}

// ?sort=<fieldKey> ascending, ?sort=-<fieldKey> descending (spec 05).
// Unknown field keys are a 400; absent sort keeps the default id ordering.
export function parseRecordSort(
  sort: string | undefined,
  fields: ObjectFieldDefinition[],
): RecordSort | null {
  if (sort === undefined || sort === '') {
    return null;
  }
  const direction = sort.startsWith('-') ? 'desc' : 'asc';
  const key = sort.startsWith('-') ? sort.slice(1) : sort;
  const field = fields.find((candidate) => candidate.key === key);
  if (!field) {
    bad(`Unknown sort field "${key}"`);
  }
  return { field, direction };
}
