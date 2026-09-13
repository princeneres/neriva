import { describe, expect, it } from 'vitest';
import { assertProductionAuthConfig } from './auth-config';

describe('assertProductionAuthConfig', () => {
  it('allows development defaults outside production', () => {
    expect(() =>
      assertProductionAuthConfig({ NODE_ENV: 'development', JWT_ACCESS_SECRET: 'change-me' }),
    ).not.toThrow();
  });

  it('rejects a missing production secret', () => {
    expect(() => assertProductionAuthConfig({ NODE_ENV: 'production' })).toThrow(
      'JWT_ACCESS_SECRET must be set in production',
    );
  });

  it('rejects example and short production secrets', () => {
    expect(() =>
      assertProductionAuthConfig({ NODE_ENV: 'production', JWT_ACCESS_SECRET: 'change-me' }),
    ).toThrow('random value');
    expect(() =>
      assertProductionAuthConfig({ NODE_ENV: 'production', JWT_ACCESS_SECRET: 'too-short' }),
    ).toThrow('random value');
  });

  it('accepts a sufficiently long production secret', () => {
    expect(() =>
      assertProductionAuthConfig({
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'a-random-production-secret-with-at-least-32-chars',
      }),
    ).not.toThrow();
  });
});
