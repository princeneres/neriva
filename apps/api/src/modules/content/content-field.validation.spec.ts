import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { ContentFieldDefinition } from '../../db/schema';
import {
  normalizeContentTypeFields,
  validateEntryValues,
  type ContentFieldInput,
} from './content-field.validation';

const fields: ContentFieldDefinition[] = [
  { key: 'headline', label: 'Headline', type: 'text', required: true },
  { key: 'body', label: 'Body', type: 'richtext', required: false },
  { key: 'rating', label: 'Rating', type: 'number', required: false },
  { key: 'featured', label: 'Featured', type: 'boolean', required: false },
  { key: 'publishedOn', label: 'Published on', type: 'date', required: false },
];

describe('normalizeContentTypeFields', () => {
  it('accepts a valid field list', () => {
    expect(normalizeContentTypeFields(fields)).toEqual(fields);
  });

  it('accepts an empty field list', () => {
    expect(normalizeContentTypeFields([])).toEqual([]);
  });

  it('defaults required to false when omitted', () => {
    const normalized = normalizeContentTypeFields([{ key: 'headline', label: 'H', type: 'text' }]);
    expect(normalized).toEqual([{ key: 'headline', label: 'H', type: 'text', required: false }]);
  });

  it('rejects keys not matching the pattern', () => {
    for (const key of ['Headline', '1abc', 'snake_case', 'kebab-case', '']) {
      expect(() =>
        normalizeContentTypeFields([{ key, label: 'X', type: 'text', required: false }]),
      ).toThrow(BadRequestException);
    }
  });

  it('rejects duplicate keys', () => {
    expect(() =>
      normalizeContentTypeFields([
        { key: 'headline', label: 'A', type: 'text', required: false },
        { key: 'headline', label: 'B', type: 'text', required: false },
      ]),
    ).toThrow(BadRequestException);
  });

  it('rejects an empty label', () => {
    expect(() =>
      normalizeContentTypeFields([{ key: 'headline', label: '', type: 'text', required: false }]),
    ).toThrow(BadRequestException);
  });

  it('rejects unknown field types', () => {
    expect(() =>
      normalizeContentTypeFields([
        // Cast: exercising the runtime guard against a type outside the union.
        {
          key: 'headline',
          label: 'H',
          type: 'picklist' as ContentFieldInput['type'],
          required: false,
        },
      ]),
    ).toThrow(BadRequestException);
  });

  it('rejects a non-boolean required flag', () => {
    expect(() =>
      normalizeContentTypeFields([
        // Cast: exercising the runtime guard against a non-boolean flag.
        {
          key: 'headline',
          label: 'H',
          type: 'text',
          required: 'yes' as unknown as boolean,
        },
      ]),
    ).toThrow(BadRequestException);
  });
});

describe('validateEntryValues', () => {
  it('accepts a valid values payload', () => {
    expect(() =>
      validateEntryValues(fields, {
        headline: 'Launch day',
        body: '<p>Hello</p>',
        rating: 4.5,
        featured: true,
        publishedOn: '2026-08-01',
      }),
    ).not.toThrow();
  });

  it('accepts omitted and null optional fields', () => {
    expect(() => validateEntryValues(fields, { headline: 'X', rating: null })).not.toThrow();
  });

  it('rejects unknown keys', () => {
    expect(() => validateEntryValues(fields, { headline: 'X', nope: 1 })).toThrow(
      BadRequestException,
    );
  });

  it('rejects a missing required field', () => {
    expect(() => validateEntryValues(fields, { rating: 3 })).toThrow(BadRequestException);
    expect(() => validateEntryValues(fields, { headline: null })).toThrow(BadRequestException);
  });

  it('rejects wrong primitive types', () => {
    expect(() => validateEntryValues(fields, { headline: 1 })).toThrow(BadRequestException);
    expect(() => validateEntryValues(fields, { headline: 'X', body: 2 })).toThrow(
      BadRequestException,
    );
    expect(() => validateEntryValues(fields, { headline: 'X', rating: 'high' })).toThrow(
      BadRequestException,
    );
    expect(() => validateEntryValues(fields, { headline: 'X', rating: Number.NaN })).toThrow(
      BadRequestException,
    );
    expect(() => validateEntryValues(fields, { headline: 'X', featured: 'yes' })).toThrow(
      BadRequestException,
    );
  });

  it('accepts ISO 8601 date and date-time strings', () => {
    for (const value of [
      '2026-08-01',
      '2026-08-01T12:30',
      '2026-08-01T12:30:15',
      '2026-08-01T12:30:15.123Z',
      '2026-08-01T12:30:15+02:00',
    ]) {
      expect(() =>
        validateEntryValues(fields, { headline: 'X', publishedOn: value }),
      ).not.toThrow();
    }
  });

  it('rejects invalid date strings', () => {
    for (const value of [
      'tomorrow',
      '01/08/2026',
      '2026-13-01',
      '2026-02-30',
      '2026-08-01T99:99',
      '2026-08-01T12:99:00Z',
      20260801,
      true,
    ]) {
      expect(() => validateEntryValues(fields, { headline: 'X', publishedOn: value })).toThrow(
        BadRequestException,
      );
    }
  });
});
