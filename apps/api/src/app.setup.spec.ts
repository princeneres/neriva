import { describe, expect, it } from 'vitest';
import { resolveLogLevel, resolveTrustProxy } from './app.setup';

describe('resolveTrustProxy', () => {
  it('trusts nobody when the variable is absent or empty', () => {
    expect(resolveTrustProxy({})).toBe(false);
    expect(resolveTrustProxy({ TRUST_PROXY: '' })).toBe(false);
    expect(resolveTrustProxy({ TRUST_PROXY: '   ' })).toBe(false);
    expect(resolveTrustProxy({ TRUST_PROXY: 'false' })).toBe(false);
  });

  it('accepts a single CIDR range', () => {
    expect(resolveTrustProxy({ TRUST_PROXY: '172.18.0.0/16' })).toEqual(['172.18.0.0/16']);
  });

  it('accepts a comma separated list of ranges, addresses and presets', () => {
    expect(
      resolveTrustProxy({ TRUST_PROXY: '172.18.0.0/16, 127.0.0.1 ,fd00::/8, loopback' }),
    ).toEqual(['172.18.0.0/16', '127.0.0.1', 'fd00::/8', 'loopback']);
  });

  it('accepts an explicit true, the blanket-trust escape hatch', () => {
    expect(resolveTrustProxy({ TRUST_PROXY: 'true' })).toBe(true);
  });

  it('rejects a hop count, which is spoofable in this fastify version', () => {
    expect(() => resolveTrustProxy({ TRUST_PROXY: '1' })).toThrow('GHSA-3m5p-2c4r-xxw2');
  });

  it('rejects values that are not addresses or ranges', () => {
    expect(() => resolveTrustProxy({ TRUST_PROXY: 'proxy.internal' })).toThrow(
      'TRUST_PROXY entry "proxy.internal"',
    );
    expect(() => resolveTrustProxy({ TRUST_PROXY: '172.18.0.0/33' })).toThrow('TRUST_PROXY entry');
    expect(() => resolveTrustProxy({ TRUST_PROXY: '172.18.0.0/' })).toThrow('TRUST_PROXY entry');
    expect(() => resolveTrustProxy({ TRUST_PROXY: '999.1.1.1' })).toThrow('TRUST_PROXY entry');
    expect(() => resolveTrustProxy({ TRUST_PROXY: '172.18.0.0/16,bogus' })).toThrow(
      'TRUST_PROXY entry "bogus"',
    );
  });
});

describe('resolveLogLevel', () => {
  it('logs requests in production and stays quiet elsewhere', () => {
    expect(resolveLogLevel({ NODE_ENV: 'production' })).toBe('info');
    expect(resolveLogLevel({ NODE_ENV: 'development' })).toBe('warn');
    expect(resolveLogLevel({})).toBe('warn');
  });

  it('honours an explicit level', () => {
    expect(resolveLogLevel({ NODE_ENV: 'production', LOG_LEVEL: 'debug' })).toBe('debug');
    expect(resolveLogLevel({ LOG_LEVEL: 'SILENT' })).toBe('silent');
  });

  it('rejects an unknown level', () => {
    expect(() => resolveLogLevel({ LOG_LEVEL: 'verbose' })).toThrow('LOG_LEVEL must be one of');
  });
});
