import { describe, expect, it } from 'vitest';
import {
  clampLimit,
  decodeCursor,
  DEFAULT_PAGE_LIMIT,
  encodeCursor,
  InvalidCursorError,
  MAX_PAGE_LIMIT,
} from './pagination';

describe('clampLimit', () => {
  it('defaults to 20', () => {
    expect(clampLimit()).toBe(DEFAULT_PAGE_LIMIT);
  });

  it('caps at 100 and floors at 1', () => {
    expect(clampLimit(500)).toBe(MAX_PAGE_LIMIT);
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(-5)).toBe(1);
  });

  it('truncates fractional limits', () => {
    expect(clampLimit(2.9)).toBe(2);
  });
});

describe('cursor codec', () => {
  it('round-trips an id', () => {
    const id = '01936b2a-0000-7000-8000-000000000000';
    expect(decodeCursor(encodeCursor(id))).toEqual({ id });
  });

  it('rejects garbage cursors', () => {
    expect(() => decodeCursor('not-a-cursor')).toThrow(InvalidCursorError);
    expect(() => decodeCursor(Buffer.from('{"nope":1}').toString('base64url'))).toThrow(
      InvalidCursorError,
    );
  });
});
