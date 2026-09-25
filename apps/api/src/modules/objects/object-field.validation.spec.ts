import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { ObjectFieldDefinition } from '../../db/schema';
import {
  DEFAULT_RECORD_SIZE_LIMITS,
  PUBLIC_RECORD_SIZE_LIMITS,
  validateDefinitionFields,
  validateRecordData,
} from './object-field.validation';

const fields: ObjectFieldDefinition[] = [
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'severity', label: 'Severity', type: 'number', required: false },
  { key: 'open', label: 'Open', type: 'boolean', required: false },
  { key: 'dueDate', label: 'Due date', type: 'date', required: false },
  { key: 'status', label: 'Status', type: 'picklist', required: false, options: ['new', 'done'] },
];

describe('validateDefinitionFields', () => {
  it('accepts a valid field list', () => {
    expect(() => validateDefinitionFields(fields)).not.toThrow();
  });

  it('accepts an empty field list', () => {
    expect(() => validateDefinitionFields([])).not.toThrow();
  });

  it('rejects keys not matching the pattern', () => {
    for (const key of ['Title', '1abc', 'snake_case', 'kebab-case', '']) {
      expect(() =>
        validateDefinitionFields([{ key, label: 'X', type: 'text', required: false }]),
      ).toThrow(BadRequestException);
    }
  });

  it('rejects duplicate keys', () => {
    expect(() =>
      validateDefinitionFields([
        { key: 'title', label: 'A', type: 'text', required: false },
        { key: 'title', label: 'B', type: 'text', required: false },
      ]),
    ).toThrow(BadRequestException);
  });

  it('rejects an empty label', () => {
    expect(() =>
      validateDefinitionFields([{ key: 'title', label: '', type: 'text', required: false }]),
    ).toThrow(BadRequestException);
  });

  it('rejects unknown field types', () => {
    expect(() =>
      validateDefinitionFields([
        // Cast: exercising the runtime guard against a type outside the union.
        {
          key: 'title',
          label: 'T',
          type: 'richtext' as ObjectFieldDefinition['type'],
          required: false,
        },
      ]),
    ).toThrow(BadRequestException);
  });

  it('rejects a picklist without options', () => {
    expect(() =>
      validateDefinitionFields([{ key: 'status', label: 'S', type: 'picklist', required: false }]),
    ).toThrow(BadRequestException);
  });

  it('rejects a picklist with empty options', () => {
    expect(() =>
      validateDefinitionFields([
        { key: 'status', label: 'S', type: 'picklist', required: false, options: [] },
      ]),
    ).toThrow(BadRequestException);
  });

  it('rejects a picklist with duplicate options', () => {
    expect(() =>
      validateDefinitionFields([
        { key: 'status', label: 'S', type: 'picklist', required: false, options: ['a', 'a'] },
      ]),
    ).toThrow(BadRequestException);
  });

  it('rejects options on non-picklist fields', () => {
    expect(() =>
      validateDefinitionFields([
        { key: 'title', label: 'T', type: 'text', required: false, options: ['a'] },
      ]),
    ).toThrow(BadRequestException);
  });
});

describe('validateRecordData', () => {
  it('accepts a full valid payload', () => {
    expect(() =>
      validateRecordData(fields, {
        title: 'Bug report',
        severity: 3,
        open: true,
        dueDate: '2026-08-08',
        status: 'new',
      }),
    ).not.toThrow();
  });

  it('accepts omitted and null optional fields', () => {
    expect(() => validateRecordData(fields, { title: 'Bug', severity: null })).not.toThrow();
  });

  it('rejects unknown keys', () => {
    expect(() => validateRecordData(fields, { title: 'Bug', nope: 1 })).toThrow(
      BadRequestException,
    );
  });

  it('rejects a missing required field', () => {
    expect(() => validateRecordData(fields, { severity: 1 })).toThrow(BadRequestException);
  });

  it('rejects null for a required field', () => {
    expect(() => validateRecordData(fields, { title: null })).toThrow(BadRequestException);
  });

  it('rejects wrong types', () => {
    expect(() => validateRecordData(fields, { title: 42 })).toThrow(BadRequestException);
    expect(() => validateRecordData(fields, { title: 'x', severity: '3' })).toThrow(
      BadRequestException,
    );
    expect(() => validateRecordData(fields, { title: 'x', severity: Number.NaN })).toThrow(
      BadRequestException,
    );
    expect(() => validateRecordData(fields, { title: 'x', open: 'true' })).toThrow(
      BadRequestException,
    );
  });

  it('rejects malformed and impossible dates', () => {
    expect(() => validateRecordData(fields, { title: 'x', dueDate: '08/08/2026' })).toThrow(
      BadRequestException,
    );
    expect(() => validateRecordData(fields, { title: 'x', dueDate: '2026-13-40' })).toThrow(
      BadRequestException,
    );
  });

  it('rejects picklist values outside the options', () => {
    expect(() => validateRecordData(fields, { title: 'x', status: 'archived' })).toThrow(
      BadRequestException,
    );
  });
  it('accepts a text value at the default ceiling and rejects one past it', () => {
    const atLimit = 'a'.repeat(DEFAULT_RECORD_SIZE_LIMITS.maxTextLength);
    expect(() => validateRecordData(fields, { title: atLimit })).not.toThrow();
    expect(() => validateRecordData(fields, { title: `${atLimit}a` })).toThrow(BadRequestException);
  });

  it('rejects a payload over the byte ceiling before looking at the fields', () => {
    // Multi-byte padding: the limit is on bytes, so a caller cannot buy room
    // by switching alphabet.
    const oversized = 'ã'.repeat(DEFAULT_RECORD_SIZE_LIMITS.maxPayloadBytes);
    expect(() => validateRecordData(fields, { title: oversized })).toThrow(BadRequestException);
  });

  it('applies the tighter public limits when they are passed', () => {
    const overPublic = 'a'.repeat(PUBLIC_RECORD_SIZE_LIMITS.maxTextLength + 1);
    expect(() => validateRecordData(fields, { title: overPublic })).not.toThrow();
    expect(() =>
      validateRecordData(fields, { title: overPublic }, PUBLIC_RECORD_SIZE_LIMITS),
    ).toThrow(BadRequestException);
  });
});
