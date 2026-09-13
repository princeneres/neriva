import { describe, expect, it } from 'vitest';
import { initialAdminPassword } from './seed.service';

describe('initialAdminPassword', () => {
  it('keeps the test/development bootstrap compatible', () => {
    expect(initialAdminPassword({ NODE_ENV: 'test' })).toBe('admin');
  });

  it('requires a long configured password in production', () => {
    expect(() => initialAdminPassword({ NODE_ENV: 'production' })).toThrow(
      'NERIVA_INITIAL_ADMIN_PASSWORD',
    );
    expect(() =>
      initialAdminPassword({ NODE_ENV: 'production', NERIVA_INITIAL_ADMIN_PASSWORD: 'short' }),
    ).toThrow('15 characters');
  });

  it('returns the configured production password', () => {
    const password = 'a-random-bootstrap-password';
    expect(
      initialAdminPassword({ NODE_ENV: 'production', NERIVA_INITIAL_ADMIN_PASSWORD: password }),
    ).toBe(password);
  });
});
