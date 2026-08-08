import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './utils/test-app';
import { startTestDb, type TestDb } from './utils/test-db';

interface TokensBody {
  data: { accessToken: string; refreshToken: string; mustChangePassword: boolean };
}

describe('auth module (e2e)', () => {
  let testDb: TestDb;
  let app: NestFastifyApplication;

  beforeAll(async () => {
    testDb = await startTestDb();
    app = await createTestApp(testDb.connectionUri);
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  it('serves public health without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
  });

  it('rejects unauthenticated requests with problem+json', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me' });
    expect(res.statusCode).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.json()).toMatchObject({ status: 401, title: 'Unauthorized' });
  });

  describe('forced password change flow', () => {
    let firstTokens: TokensBody['data'];

    it('logs in with seeded credentials and flags mustChangePassword', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'admin@neriva.com', password: 'admin' },
      });
      expect(res.statusCode).toBe(200);
      firstTokens = (res.json() as TokensBody).data;
      expect(firstTokens.mustChangePassword).toBe(true);
      expect(firstTokens.accessToken).toBeTruthy();
      expect(firstTokens.refreshToken).toBeTruthy();
    });

    it('blocks every other authenticated request with 403 problem+json', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${firstTokens.accessToken}` },
      });
      expect(res.statusCode).toBe(403);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.json()).toMatchObject({
        status: 403,
        code: 'MUST_CHANGE_PASSWORD',
        detail: 'Password change required before any other operation',
      });
    });

    it('rejects a wrong current password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/change-password',
        headers: { authorization: `Bearer ${firstTokens.accessToken}` },
        payload: { currentPassword: 'wrong', newPassword: 'brand-new-password' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects a too-short new password via validation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/change-password',
        headers: { authorization: `Bearer ${firstTokens.accessToken}` },
        payload: { currentPassword: 'admin', newPassword: 'short' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
    });

    it('accepts the password change while the flag is set', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/change-password',
        headers: { authorization: `Bearer ${firstTokens.accessToken}` },
        payload: { currentPassword: 'admin', newPassword: 'brand-new-password' },
      });
      expect(res.statusCode).toBe(200);
      const body = (res.json() as TokensBody).data;
      expect(body.mustChangePassword).toBe(false);
    });

    it('unblocks authenticated requests after the change', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${firstTokens.accessToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { data: Record<string, unknown> };
      expect(body.data.email).toBe('admin@neriva.com');
      expect(body.data).not.toHaveProperty('passwordHash');
    });

    it('only accepts the new password from now on', async () => {
      const oldLogin = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'admin@neriva.com', password: 'admin' },
      });
      expect(oldLogin.statusCode).toBe(401);

      const newLogin = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'admin@neriva.com', password: 'brand-new-password' },
      });
      expect(newLogin.statusCode).toBe(200);
      expect((newLogin.json() as TokensBody).data.mustChangePassword).toBe(false);
    });
  });

  describe('refresh token rotation', () => {
    async function login(): Promise<TokensBody['data']> {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'admin@neriva.com', password: 'brand-new-password' },
      });
      return (res.json() as TokensBody).data;
    }

    it('rotates the refresh token on use', async () => {
      const tokens = await login();
      const first = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: tokens.refreshToken },
      });
      expect(first.statusCode).toBe(200);

      const reuse = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: tokens.refreshToken },
      });
      expect(reuse.statusCode).toBe(401);
    });

    it('revokes the refresh token on logout', async () => {
      const tokens = await login();
      const logout = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { authorization: `Bearer ${tokens.accessToken}` },
        payload: { refreshToken: tokens.refreshToken },
      });
      expect(logout.statusCode).toBe(204);

      const refresh = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: tokens.refreshToken },
      });
      expect(refresh.statusCode).toBe(401);
    });
  });
});
