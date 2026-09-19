import { describe, expect, it } from 'vitest';
import { isForeignKeyViolation, isInvalidTextRepresentation, isUniqueViolation } from './pg-errors';

// Drizzle 0.45 stopped rethrowing the driver error and started wrapping it in a
// DrizzleQueryError whose `cause` is the pg error. Every duplicate turned into a
// 500 instead of a 409 until the lookup learned to walk the chain, so both
// shapes are pinned here.
function wrapped(cause: unknown): Error {
  return new Error('Failed query: insert into "sites" ...', { cause });
}

describe('pg error codes', () => {
  it('reads the code off a bare driver error', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isForeignKeyViolation({ code: '23503' })).toBe(true);
    expect(isInvalidTextRepresentation({ code: '22P02' })).toBe(true);
  });

  it('reads the code off a wrapped driver error', () => {
    expect(isUniqueViolation(wrapped({ code: '23505' }))).toBe(true);
    expect(isForeignKeyViolation(wrapped({ code: '23503' }))).toBe(true);
    expect(isInvalidTextRepresentation(wrapped({ code: '22P02' }))).toBe(true);
  });

  it('reads the code through more than one layer of wrapping', () => {
    expect(isUniqueViolation(wrapped(wrapped({ code: '23505' })))).toBe(true);
  });

  it('does not confuse one code for another', () => {
    expect(isUniqueViolation(wrapped({ code: '23503' }))).toBe(false);
    expect(isForeignKeyViolation(wrapped({ code: '23505' }))).toBe(false);
  });

  it('returns false for errors that carry no code', () => {
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation('23505')).toBe(false);
  });

  it('terminates on a self-referencing cause', () => {
    const loop: { code: string; cause?: unknown } = { code: 'other' };
    loop.cause = loop;
    expect(isUniqueViolation(loop)).toBe(false);
  });
});
