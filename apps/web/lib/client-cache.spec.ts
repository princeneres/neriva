import { beforeEach, describe, expect, it } from 'vitest';
import {
  CACHE_MAX_ENTRIES,
  clearCache,
  dedupeInFlight,
  inFlightCount,
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

describe('dedupeInFlight', () => {
  beforeEach(() => {
    clearCache();
  });

  function deferred<T>() {
    let settle!: (value: T) => void;
    let fail!: (reason: unknown) => void;
    const promise = new Promise<T>((resolve, reject) => {
      settle = resolve;
      fail = reject;
    });
    return { promise, settle, fail };
  }

  it('sends one request for callers that overlap', async () => {
    const gate = deferred<string>();
    let sent = 0;
    const send = () => {
      sent += 1;
      return gate.promise;
    };

    const first = dedupeInFlight('GET /sites', send);
    const second = dedupeInFlight('GET /sites', send);
    expect(sent).toBe(1);
    expect(inFlightCount()).toBe(1);

    gate.settle('payload');
    await expect(first).resolves.toBe('payload');
    await expect(second).resolves.toBe('payload');
  });

  it('keeps different keys apart', async () => {
    const sent: string[] = [];
    const send = (key: string) => () => {
      sent.push(key);
      return Promise.resolve(key);
    };

    await Promise.all([
      dedupeInFlight('GET /sites', send('/sites')),
      dedupeInFlight('GET /users', send('/users')),
    ]);

    expect(sent).toEqual(['/sites', '/users']);
  });

  it('sends again once the first request answered', async () => {
    let sent = 0;
    const send = () => {
      sent += 1;
      return Promise.resolve(sent);
    };

    await expect(dedupeInFlight('GET /sites', send)).resolves.toBe(1);
    expect(inFlightCount()).toBe(0);
    await expect(dedupeInFlight('GET /sites', send)).resolves.toBe(2);
    expect(sent).toBe(2);
  });

  it('gives every joiner the same failure and then frees the key', async () => {
    const gate = deferred<string>();
    const first = dedupeInFlight('GET /sites', () => gate.promise);
    const second = dedupeInFlight('GET /sites', () => gate.promise);

    gate.fail(new Error('offline'));
    await expect(first).rejects.toThrow('offline');
    await expect(second).rejects.toThrow('offline');
    expect(inFlightCount()).toBe(0);

    await expect(dedupeInFlight('GET /sites', () => Promise.resolve('retry'))).resolves.toBe(
      'retry',
    );
  });

  it('stops a request started before logout from being joined after it', async () => {
    const gate = deferred<string>();
    let sent = 0;
    const send = () => {
      sent += 1;
      return gate.promise;
    };

    void dedupeInFlight('GET /sites', send).catch(() => undefined);
    clearCache();
    void dedupeInFlight('GET /sites', send).catch(() => undefined);

    expect(sent).toBe(2);
    gate.settle('payload');
    await gate.promise;
  });
});
