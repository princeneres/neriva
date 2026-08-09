import { describe, expect, it } from 'vitest';
import { isReservedPath } from './reserved-paths';

describe('isReservedPath', () => {
  it.each([
    '/admin',
    '/admin/pages',
    '/login',
    '/change-password',
    '/s',
    '/s/demo',
    '/_next/static/x.js',
    '/api/foo',
  ])('reserves %s', (path) => {
    expect(isReservedPath(path)).toBe(true);
  });

  it.each(['/', '/about', '/blog/post-1', '/administration', '/apis', '/services', '/store'])(
    'does not reserve %s',
    (path) => {
      expect(isReservedPath(path)).toBe(false);
    },
  );

  it('ignores leading slashes and case', () => {
    expect(isReservedPath('admin')).toBe(true);
    expect(isReservedPath('//admin')).toBe(true);
    expect(isReservedPath('/ADMIN/users')).toBe(true);
  });
});
