import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import type { ObjectFieldDefinition } from '../../db/schema';
import { parseRecordFilters, parseRecordSort } from './record-filter';

const fields: ObjectFieldDefinition[] = [
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'severity', label: 'Severity', type: 'number', required: false },
  { key: 'open', label: 'Open', type: 'boolean', required: false },
  { key: 'status', label: 'Status', type: 'picklist', required: false, options: ['new', 'done'] },
];

describe('parseRecordFilters', () => {
  it('parses a text filter as-is', () => {
    const filters = parseRecordFilters({ 'filter[title]': 'Bug' }, fields);
    expect(filters).toHaveLength(1);
    expect(filters[0]!.field.key).toBe('title');
    expect(filters[0]!.value).toBe('Bug');
  });

  it('coerces number filter values', () => {
    const filters = parseRecordFilters({ 'filter[severity]': '3' }, fields);
    expect(filters[0]!.value).toBe(3);
  });

  it('coerces boolean filter values', () => {
    expect(parseRecordFilters({ 'filter[open]': 'true' }, fields)[0]!.value).toBe(true);
    expect(parseRecordFilters({ 'filter[open]': 'false' }, fields)[0]!.value).toBe(false);
  });

  it('rejects non-numeric values for number fields', () => {
    for (const value of ['abc', '', ' ', 'Infinity']) {
      expect(() => parseRecordFilters({ 'filter[severity]': value }, fields)).toThrow(
        BadRequestException,
      );
    }
  });

  it('rejects non-boolean values for boolean fields', () => {
    expect(() => parseRecordFilters({ 'filter[open]': 'yes' }, fields)).toThrow(
      BadRequestException,
    );
  });

  it('rejects unknown field keys', () => {
    expect(() => parseRecordFilters({ 'filter[nope]': 'x' }, fields)).toThrow(BadRequestException);
    expect(() => parseRecordFilters({ 'filter[]': 'x' }, fields)).toThrow(BadRequestException);
  });

  it('collects multiple filters', () => {
    const filters = parseRecordFilters({ 'filter[title]': 'Bug', 'filter[severity]': '2' }, fields);
    expect(filters).toHaveLength(2);
  });

  it('treats a repeated parameter as independent ANDed filters', () => {
    const filters = parseRecordFilters({ 'filter[status]': ['new', 'done'] }, fields);
    expect(filters).toHaveLength(2);
    expect(filters.map((f) => f.value)).toEqual(['new', 'done']);
  });

  it('ignores non-filter query parameters', () => {
    const filters = parseRecordFilters({ limit: '10', cursor: 'abc', sort: 'title' }, fields);
    expect(filters).toHaveLength(0);
  });
});

describe('parseRecordSort', () => {
  it('returns null when sort is absent', () => {
    expect(parseRecordSort(undefined, fields)).toBeNull();
    expect(parseRecordSort('', fields)).toBeNull();
  });

  it('parses ascending sort', () => {
    const sort = parseRecordSort('severity', fields);
    expect(sort).toMatchObject({ direction: 'asc' });
    expect(sort!.field.key).toBe('severity');
  });

  it('parses descending sort with the - prefix', () => {
    const sort = parseRecordSort('-severity', fields);
    expect(sort).toMatchObject({ direction: 'desc' });
    expect(sort!.field.key).toBe('severity');
  });

  it('rejects unknown sort fields', () => {
    expect(() => parseRecordSort('nope', fields)).toThrow(BadRequestException);
  });
});
