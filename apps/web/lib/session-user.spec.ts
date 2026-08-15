import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PublicUser } from './api';
import { clearSessionUser, readSessionUser, saveSessionUser } from './session-user';

// Minimal sessionStorage stand-in: the suite runs in the node environment.
function installStorage(): Map<string, string> {
  const entries = new Map<string, string>();
  const fake: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, value),
    removeItem: (key) => void entries.delete(key),
  };
  Object.defineProperty(globalThis, 'window', {
    value: { sessionStorage: fake },
    configurable: true,
    writable: true,
  });
  return entries;
}

const user = { id: 'u1', email: 'admin@neriva.com' } as PublicUser;

describe('session-user', () => {
  let entries: Map<string, string>;

  beforeEach(() => {
    entries = installStorage();
    clearSessionUser();
  });

  afterEach(() => {
    clearSessionUser();
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('reads nothing before a save', () => {
    expect(readSessionUser()).toBeNull();
  });

  it('round-trips the profile through storage', () => {
    saveSessionUser(user);
    expect(entries.size).toBe(1);
    expect(readSessionUser()).toEqual(user);
  });

  it('recovers the profile from storage after the module copy is gone', () => {
    saveSessionUser(user);
    // Simulate a reload: storage survives, the in-memory copy does not.
    const stored = [...entries.entries()];
    clearSessionUser();
    stored.forEach(([key, value]) => entries.set(key, value));

    expect(readSessionUser()).toEqual(user);
  });

  it('ignores a corrupted entry instead of throwing', () => {
    saveSessionUser(user);
    clearSessionUser();
    entries.set('neriva.sessionUser', '{not json');

    expect(readSessionUser()).toBeNull();
  });

  it('clears both copies', () => {
    saveSessionUser(user);
    clearSessionUser();
    expect(entries.size).toBe(0);
    expect(readSessionUser()).toBeNull();
  });
});
