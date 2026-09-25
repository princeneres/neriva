import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './utils/test-app';
import { startTestDb, type TestDb } from './utils/test-db';

interface Tokens {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

interface SettingBody {
  data: {
    id: string;
    externalReferenceCode: string;
    tenantId: string;
    key: string;
    value: unknown;
  };
}

interface CatalogBody {
  data: {
    groups: { id: string; label: string; notice: string | null }[];
    settings: {
      key: string;
      group: string;
      type: string;
      effect: string;
      defaultValue: unknown;
      optionsSource: string | null;
      isSensitive: boolean;
      isSet: boolean;
      value: unknown;
    }[];
  };
}

describe('system settings (e2e)', () => {
  let testDb: TestDb;
  let app: NestFastifyApplication;
  let adminToken: string;
  let noGrantToken: string;

  async function login(email: string, password: string): Promise<Tokens> {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password },
    });
    expect(res.statusCode).toBe(200);
    return (res.json() as { data: Tokens }).data;
  }

  // Logs in, satisfies the forced password change, returns a usable token.
  async function loginFresh(
    email: string,
    tempPassword: string,
    newPassword: string,
  ): Promise<string> {
    const first = await login(email, tempPassword);
    const change = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      headers: { authorization: `Bearer ${first.accessToken}` },
      payload: { currentPassword: tempPassword, newPassword },
    });
    expect(change.statusCode).toBe(200);
    return (change.json() as { data: Tokens }).data.accessToken;
  }

  beforeAll(async () => {
    testDb = await startTestDb();
    app = await createTestApp(testDb.connectionUri);
    adminToken = await loginFresh('admin@neriva.com', 'admin', 'admin-password-1');

    // A role with no system-setting grants at all, for the denied case.
    const role = await app.inject({
      method: 'POST',
      url: '/roles',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Settings Bystander',
        permissions: [{ resourceType: 'user', action: 'read' }],
      },
    });
    expect(role.statusCode).toBe(201);
    const roleId = (role.json() as { data: { id: string } }).data.id;

    const user = await app.inject({
      method: 'POST',
      url: '/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        email: 'bystander@neriva.com',
        displayName: 'Bystander',
        password: 'bystander-temp-pass',
        roleIds: [roleId],
      },
    });
    expect(user.statusCode).toBe(201);
    noGrantToken = await loginFresh(
      'bystander@neriva.com',
      'bystander-temp-pass',
      'bystander-final-pass',
    );
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  it('creates a setting with PUT and returns 201', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/system/settings/site.name',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { value: 'Neriva Demo' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as SettingBody;
    expect(body.data.key).toBe('site.name');
    expect(body.data.value).toBe('Neriva Demo');
    expect(body.data.id).toBeTruthy();
    expect(body.data.tenantId).toBeTruthy();
    expect(body.data.externalReferenceCode).toBeTruthy();
  });

  it('updates the same setting with PUT and returns 200, keeping the id', async () => {
    const first = await app.inject({
      method: 'GET',
      url: '/system/settings/site.name',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const originalId = (first.json() as SettingBody).data.id;

    const res = await app.inject({
      method: 'PUT',
      url: '/system/settings/site.name',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { value: 'Neriva Prod' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as SettingBody;
    expect(body.data.value).toBe('Neriva Prod');
    expect(body.data.id).toBe(originalId);
  });

  it('stores any JSON shape as the value', async () => {
    const value = { host: 'smtp.example.com', port: 587, tls: true, tags: ['a', 'b'] };
    const res = await app.inject({
      method: 'PUT',
      url: '/system/settings/smtp.host',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { value },
    });
    expect(res.statusCode).toBe(201);
    expect((res.json() as SettingBody).data.value).toEqual(value);
  });

  it('gets a setting by key', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/system/settings/site.name',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as SettingBody;
    expect(body.data.key).toBe('site.name');
    expect(body.data.value).toBe('Neriva Prod');
  });

  it('returns 404 for a missing key', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/system/settings/site.unknown',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('lists settings with the cursor envelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/system/settings',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data: { key: string }[];
      meta: { cursor: string | null; limit: number };
    };
    expect(body.meta.limit).toBe(20);
    const keys = body.data.map((s) => s.key);
    expect(keys).toContain('site.name');
    expect(keys).toContain('smtp.host');
  });

  it('rejects an invalid key pattern with 400', async () => {
    for (const badKey of ['Bad-Key', '1starts-with-digit', 'has_underscore']) {
      const res = await app.inject({
        method: 'PUT',
        url: `/system/settings/${badKey}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { value: 'x' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
    }

    const get = await app.inject({
      method: 'GET',
      url: '/system/settings/Bad-Key',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(get.statusCode).toBe(400);
  });

  it('rejects a missing value with 400', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/system/settings/site.description',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('deletes a setting by key with 204', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/system/settings/smtp.host',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(204);

    const gone = await app.inject({
      method: 'GET',
      url: '/system/settings/smtp.host',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(gone.statusCode).toBe(404);
  });

  it('denies every settings action for a role with no system-setting grants', async () => {
    const list = await app.inject({
      method: 'GET',
      url: '/system/settings',
      headers: { authorization: `Bearer ${noGrantToken}` },
    });
    expect(list.statusCode).toBe(403);
    expect(list.json()).toMatchObject({
      status: 403,
      code: 'PERMISSION_DENIED',
      detail: 'Missing permission system-setting:read',
    });

    const put = await app.inject({
      method: 'PUT',
      url: '/system/settings/site.name',
      headers: { authorization: `Bearer ${noGrantToken}` },
      payload: { value: 'hijacked' },
    });
    expect(put.statusCode).toBe(403);

    const del = await app.inject({
      method: 'DELETE',
      url: '/system/settings/site.name',
      headers: { authorization: `Bearer ${noGrantToken}` },
    });
    expect(del.statusCode).toBe(403);
  });

  it('requires authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/system/settings' });
    expect(res.statusCode).toBe(401);
  });

  async function getCatalog(token: string): Promise<{ statusCode: number; body: CatalogBody }> {
    const res = await app.inject({
      method: 'GET',
      url: '/system/settings-catalog',
      headers: { authorization: `Bearer ${token}` },
    });
    return { statusCode: res.statusCode, body: res.json() as CatalogBody };
  }

  it('describes the known settings, their group and whether anything reads them', async () => {
    const { statusCode, body } = await getCatalog(adminToken);
    expect(statusCode).toBe(200);

    const groupIds = body.data.groups.map((group) => group.id);
    expect(groupIds).toContain('site');
    expect(groupIds).toContain('email');
    // Nothing sends email yet, so that group has to say so.
    expect(body.data.groups.find((group) => group.id === 'email')?.notice).toBeTruthy();

    const defaultSite = body.data.settings.find((entry) => entry.key === 'site.default');
    expect(defaultSite).toMatchObject({
      group: 'site',
      type: 'select',
      optionsSource: 'SITES',
      effect: 'APPLIED',
    });

    const smtpPort = body.data.settings.find((entry) => entry.key === 'smtp.port');
    // smtp.host was deleted above, so the whole group is unset and clients
    // have to fall back to the catalog default.
    expect(smtpPort).toMatchObject({ type: 'number', defaultValue: 587, effect: 'STORED' });
    expect(body.data.settings.find((entry) => entry.key === 'smtp.host')).toMatchObject({
      isSet: false,
      value: null,
    });
  });

  it('reports the stored value of a known setting that is set', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: '/system/settings/smtp.from',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { value: 'no-reply@example.com' },
    });
    expect([200, 201]).toContain(put.statusCode);

    const { body } = await getCatalog(adminToken);
    expect(body.data.settings.find((entry) => entry.key === 'smtp.from')).toMatchObject({
      isSet: true,
      value: 'no-reply@example.com',
      isSensitive: false,
    });
  });

  it('never hands back a password through the catalog', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: '/system/settings/smtp.password',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { value: 'do-not-return-this' },
    });
    expect([200, 201]).toContain(put.statusCode);

    const { body } = await getCatalog(adminToken);
    expect(body.data.settings.find((entry) => entry.key === 'smtp.password')).toMatchObject({
      type: 'password',
      isSensitive: true,
      isSet: true,
      value: null,
    });
    expect(JSON.stringify(body)).not.toContain('do-not-return-this');

    const direct = await app.inject({
      method: 'GET',
      url: '/system/settings/smtp.password',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(direct.statusCode).toBe(200);
    expect((direct.json() as SettingBody).data.value).toBeNull();
  });

  it('gates the catalog behind system-setting:read', async () => {
    const denied = await getCatalog(noGrantToken);
    expect(denied.statusCode).toBe(403);

    const anonymous = await app.inject({ method: 'GET', url: '/system/settings-catalog' });
    expect(anonymous.statusCode).toBe(401);
  });

  it('leaves a stored setting literally named "catalog" reachable', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: '/system/settings/catalog',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { value: 'free-form key, not the catalog route' },
    });
    expect([200, 201]).toContain(put.statusCode);

    const res = await app.inject({
      method: 'GET',
      url: '/system/settings/catalog',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as SettingBody).data.value).toBe('free-form key, not the catalog route');
  });
});
