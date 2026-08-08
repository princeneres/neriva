import { describe, expect, it } from 'vitest';
import { parseDurationMs } from './duration';

describe('parseDurationMs', () => {
  it('parses each unit', () => {
    expect(parseDurationMs('30s')).toBe(30_000);
    expect(parseDurationMs('15m')).toBe(900_000);
    expect(parseDurationMs('12h')).toBe(43_200_000);
    expect(parseDurationMs('30d')).toBe(2_592_000_000);
  });

  it('rejects malformed input', () => {
    expect(() => parseDurationMs('15')).toThrow();
    expect(() => parseDurationMs('m15')).toThrow();
    expect(() => parseDurationMs('15w')).toThrow();
  });
});
