'use client';

import type { components } from '@neriva/contracts';

export type SystemSetting = components['schemas']['SystemSettingDto'];

type RawCatalogEntry = components['schemas']['SettingCatalogEntryDto'];

// `value` and `defaultValue` hold any JSON, which openapi-typescript renders
// as an empty-object record. Widening them to unknown is what the rest of the
// screen actually works against.
export type CatalogEntry = Omit<RawCatalogEntry, 'value' | 'defaultValue'> & {
  value: unknown;
  defaultValue: unknown;
};

export type CatalogGroup = components['schemas']['SettingGroupDto'];

export interface SettingsCatalog {
  groups: CatalogGroup[];
  settings: CatalogEntry[];
}

export const KEY_PATTERN = /^[a-z][a-z0-9.-]*$/;

export const KEY_HINT = 'Lowercase letters, digits, dots and dashes; must start with a letter.';

export const VALUE_DESCRIPTION =
  'Any JSON value: text in quotes, numbers and true/false as-is. Plain text that is not valid JSON is saved as text.';

// UX decision: the value input accepts any JSON text. If the input is not
// valid JSON (for example a bare hostname like smtp.example.com), it is sent
// as a JSON string instead of rejecting the form. Users can still force a
// string by quoting it ("8025" stays the number 8025, "\"8025\"" is a string).
export function parseValueInput(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function previewValue(value: unknown, max = 80): string {
  const text = JSON.stringify(value) ?? '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// Maps RFC 7807 `errors` messages to the form field they name (messages
// produced by the API start with the property name, e.g. "key must match ...").
export function splitFieldErrors(errors: string[] | undefined): {
  key: string | null;
  value: string | null;
  other: string[];
} {
  const result: { key: string | null; value: string | null; other: string[] } = {
    key: null,
    value: null,
    other: [],
  };
  for (const message of errors ?? []) {
    const firstWord = message.trim().split(/\s+/)[0]?.toLowerCase();
    if (firstWord === 'key') {
      result.key ??= message;
    } else if (firstWord === 'value') {
      result.value ??= message;
    } else {
      result.other.push(message);
    }
  }
  return result;
}

export type FieldValue = string | boolean;

function effectiveValue(entry: CatalogEntry): unknown {
  return entry.isSet ? entry.value : entry.defaultValue;
}

// True when a row exists whose JSON shape cannot be edited by the typed input
// the catalog asks for, e.g. an object stored under a text field by an API
// client. Those are shown read-only and sent to the raw editor instead of
// being flattened into a string on the next save.
export function hasIncompatibleValue(entry: CatalogEntry): boolean {
  if (!entry.isSet || entry.isSensitive) {
    return false;
  }
  const value = entry.value;
  if (value === null) {
    return false;
  }
  if (entry.type === 'boolean') {
    return typeof value !== 'boolean';
  }
  if (entry.type === 'number') {
    return typeof value !== 'number';
  }
  return typeof value !== 'string';
}

export function initialFieldValue(entry: CatalogEntry): FieldValue {
  if (entry.type === 'boolean') {
    return effectiveValue(entry) === true;
  }
  // A saved secret is never returned, so the input starts blank and an empty
  // submission means "leave what is stored alone".
  if (entry.type === 'password') {
    return '';
  }
  const value = effectiveValue(entry);
  if (value === null || value === undefined) {
    return '';
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function fieldError(entry: CatalogEntry, field: FieldValue): string | null {
  if (entry.type !== 'number' || typeof field !== 'string' || field.trim() === '') {
    return null;
  }
  return Number.isFinite(Number(field)) ? null : 'Enter a number.';
}

function toSettingValue(entry: CatalogEntry, field: FieldValue): unknown {
  if (entry.type === 'boolean') {
    return field === true;
  }
  const text = typeof field === 'string' ? field : String(field);
  return entry.type === 'number' ? Number(text) : text;
}

export interface SettingSaveAction {
  key: string;
  method: 'PUT' | 'DELETE';
  value?: unknown;
}

// What a group's Save has to send. Clearing a field deletes the row so the
// catalog default applies again, which is the only way back to "automatic"
// once a value has been set.
export function planSave(
  entries: CatalogEntry[],
  fields: Record<string, FieldValue>,
): SettingSaveAction[] {
  const actions: SettingSaveAction[] = [];
  for (const entry of entries) {
    if (hasIncompatibleValue(entry)) {
      continue;
    }
    const field = fields[entry.key];
    if (field === undefined) {
      continue;
    }
    const isBlank = typeof field === 'string' && field.trim() === '';
    if (entry.type === 'password') {
      if (!isBlank) {
        actions.push({ key: entry.key, method: 'PUT', value: field });
      }
      continue;
    }
    if (isBlank) {
      if (entry.isSet) {
        actions.push({ key: entry.key, method: 'DELETE' });
      }
      continue;
    }
    const next = toSettingValue(entry, field);
    const current = entry.isSet ? entry.value : undefined;
    if (entry.isSet && JSON.stringify(current) === JSON.stringify(next)) {
      continue;
    }
    if (!entry.isSet && JSON.stringify(entry.defaultValue) === JSON.stringify(next)) {
      // Matching the default needs no row; storing it would only pin the value
      // if the default ever changes.
      continue;
    }
    actions.push({ key: entry.key, method: 'PUT', value: next });
  }
  return actions;
}
