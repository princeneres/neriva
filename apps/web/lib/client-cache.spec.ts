import { beforeEach, describe, expect, it } from 'vitest';
import {
  CACHE_MAX_ENTRIES,
  clearCache,
  invalidateCache,
  readCache,
  writeCache,
} from './client-cache';

describe('client-cache', () => {
  beforeEach(() => {
    clearCache();
  });

  it('returns undefined for a key never written', () => {
    expect(readCache('/sites')).toBeUndefined();
  });

  it('round-trips a value', () => {
    writeCache('/sites', { items: [1, 2] });
    expect(readCache<{ items: number[] }>('/sites')).toEqual({ items: [1, 2] });
  });

  it('distinguishes a cached undefined-free empty payload from a miss', () => {
    writeCache('/sites', { items: [] });
    expect(readCache('/sites')).toEqual({ items: [] });
    invalidateCache('/sites');
    expect(readCache('/sites')).toBeUndefined();
  });

  it('overwrites on a second write', () => {
    writeCache('/sites', 'first');
    writeCache('/sites', 'second');
    expect(readCache('/sites')).toBe('second');
  });

  it('evicts the least recently used key past the cap', () => {
    for (let i = 0; i < CACHE_MAX_ENTRIES; i += 1) {
      writeCache(`/key-${i}`, i);
    }
    // Touch the oldest key so the next write evicts the second oldest instead.
    expect(readCache('/key-0')).toBe(0);
    writeCache('/overflow', 'x');

    expect(readCache('/key-0')).toBe(0);
    expect(readCache('/key-1')).toBeUndefined();
    expect(readCache('/overflow')).toBe('x');
  });

  it('drops everything on clear', () => {
    writeCache('/sites', 'a');
    writeCache('/pages', 'b');
    clearCache();
    expect(readCache('/sites')).toBeUndefined();
    expect(readCache('/pages')).toBeUndefined();
  });
});
