import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './utils/test-app';
import { startTestDb, type TestDb } from './utils/test-db';

interface Tokens {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

interface DefaultSiteBody {
  data: { name: string; slug: string };
}

async function loginFresh(
  app: NestFastifyApplication,
  email: string,
  tempPassword: string,
  newPassword: string,
): Promise<string> {
  const first = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password: tempPassword },
  });
  expect(first.statusCode).toBe(200);
  const tokens = (first.json() as { data: Tokens }).data;
  const change = await app.inject({
    method: 'POST',
    url: '/auth/change-password',
    headers: { authorization: `Bearer ${tokens.accessToken}` },
    payload: { currentPassword: tempPassword, newPassword },
  });
  expect(change.statusCode).toBe(200);
  return (change.json() as { data: Tokens }).data.accessToken;
}

describe('default site resolution (e2e)', () => {
  let testDb: TestDb;
  let app: NestFastifyApplication;
  let adminToken: string;

  async function getDefaultSite(): Promise<{ statusCode: number; body: DefaultSiteBody }> {
    const res = await app.inject({ method: 'GET', url: '/public/site' });
    return { statusCode: res.statusCode, body: res.json() as DefaultSiteBody };
  }

  async function setDefaultSiteSetting(value: unknown): Promise<void> {
    const res = await app.inject({
      method: 'PUT',
      url: '/system/settings/site.default',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { value },
    });
    expect([200, 201]).toContain(res.statusCode);
  }

  beforeAll(async () => {
    testDb = await startTestDb();
    app = await createTestApp(testDb.connectionUri);
    adminToken = await loginFresh(app, 'admin@neriva.com', 'admin', 'admin-password-1');
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  it('serves the oldest site anonymously when no setting exists', async () => {
    const { statusCode, body } = await getDefaultSite();
    expect(statusCode).toBe(200);
    // The demo seed creates the first (and oldest) site.
    expect(body.data).toEqual({ name: 'Demo Site', slug: 'demo' });
  });

  it('keeps the oldest site as default when newer sites exist', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/sites',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Alpha', slug: 'alpha' },
    });
    expect(created.statusCode).toBe(201);

    const { statusCode, body } = await getDefaultSite();
    expect(statusCode).toBe(200);
    expect(body.data.slug).toBe('demo');
  });

  it('lets the site.default setting win when its slug exists', async () => {
    await setDefaultSiteSetting('alpha');
    const { statusCode, body } = await getDefaultSite();
    expect(statusCode).toBe(200);
    expect(body.data).toEqual({ name: 'Alpha', slug: 'alpha' });
  });

  it('falls back to the oldest site when the setting points at a missing slug', async () => {
    await setDefaultSiteSetting('no-such-site');
    const { statusCode, body } = await getDefaultSite();
    expect(statusCode).toBe(200);
    expect(body.data.slug).toBe('demo');
  });

  it('falls back to the oldest site when the setting value is not a string', async () => {
    await setDefaultSiteSetting({ slug: 'alpha' });
    const { statusCode, body } = await getDefaultSite();
    expect(statusCode).toBe(200);
    expect(body.data.slug).toBe('demo');
  });
});

describe('default site with no sites at all (e2e)', () => {
  let testDb: TestDb;
  let app: NestFastifyApplication;

  beforeAll(async () => {
    testDb = await startTestDb();
    // Skip the demo content so the install has zero sites.
    process.env.SEED_DEMO = 'false';
    app = await createTestApp(testDb.connectionUri);
    delete process.env.SEED_DEMO;
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  it('returns 404 problem+json when no sites exist', async () => {
    const res = await app.inject({ method: 'GET', url: '/public/site' });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });
});
