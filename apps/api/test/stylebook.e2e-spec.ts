import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './utils/test-app';
import { startTestDb, type TestDb } from './utils/test-db';

interface Tokens {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

interface StyleBook {
  id: string;
  externalReferenceCode: string;
  tenantId: string;
  status: string;
  name: string;
  version: number;
  tokens: Record<string, string>;
}

describe('style books (e2e)', () => {
  let testDb: TestDb;
  let app: NestFastifyApplication;
  let adminToken: string;
  let editorToken: string;
  let styleBookId: string;

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

    // A user whose role has no style-book grants, for the denied case.
    const role = await app.inject({
      method: 'POST',
      url: '/roles',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Content Editor',
        permissions: [{ resourceType: 'user', action: 'read' }],
      },
    });
    expect(role.statusCode).toBe(201);
    const roleId = (role.json() as { data: { id: string } }).data.id;

    const editor = await app.inject({
      method: 'POST',
      url: '/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        email: 'editor@neriva.com',
        displayName: 'Editor',
        password: 'editor-temp-pass',
        roleIds: [roleId],
      },
    });
    expect(editor.statusCode).toBe(201);
    editorToken = await loginFresh('editor@neriva.com', 'editor-temp-pass', 'editor-final-pass');
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  it('creates a style book as DRAFT version 1', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/style-books',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Default',
        tokens: { 'color-primary': '#cc3d47', 'space-4': '1rem' },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { data: StyleBook };
    styleBookId = body.data.id;
    expect(body.data.status).toBe('DRAFT');
    expect(body.data.version).toBe(1);
    expect(body.data.tokens).toEqual({ 'color-primary': '#cc3d47', 'space-4': '1rem' });
    expect(body.data.tenantId).toBeTruthy();
    expect(body.data.externalReferenceCode).toBeTruthy();
  });

  it('lists style books with the cursor envelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/style-books',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data: StyleBook[];
      meta: { cursor: string | null; limit: number };
    };
    expect(body.data.some((sb) => sb.id === styleBookId)).toBe(true);
    expect(body.meta.limit).toBe(20);
  });

  it('gets a style book by UUID and by erc reference', async () => {
    const byId = await app.inject({
      method: 'GET',
      url: `/style-books/${styleBookId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(byId.statusCode).toBe(200);
    const erc = (byId.json() as { data: StyleBook }).data.externalReferenceCode;

    const byErc = await app.inject({
      method: 'GET',
      url: `/style-books/erc:${erc}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(byErc.statusCode).toBe(200);
    expect((byErc.json() as { data: StyleBook }).data.id).toBe(styleBookId);
  });

  it('rejects invalid token names and values with 400 listing offending keys', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/style-books',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Broken',
        tokens: { 'Color-Primary': '#fff', 'empty-value': '', 'space-4': '1rem' },
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const body = res.json() as { detail: string };
    expect(body.detail).toContain('Color-Primary');
    expect(body.detail).toContain('empty-value');
    expect(body.detail).not.toContain('space-4');
  });

  it('rejects a duplicate name with 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/style-books',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Default', tokens: { 'color-primary': '#000' } },
    });
    expect(res.statusCode).toBe(409);
  });

  it('rejects a duplicate externalReferenceCode with 409', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/style-books',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'With ERC',
        externalReferenceCode: 'sb-fixed-erc',
        tokens: { 'color-primary': '#111' },
      },
    });
    expect(first.statusCode).toBe(201);

    const dup = await app.inject({
      method: 'POST',
      url: '/style-books',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Other Name',
        externalReferenceCode: 'sb-fixed-erc',
        tokens: { 'color-primary': '#222' },
      },
    });
    expect(dup.statusCode).toBe(409);
  });

  it('updates name and tokens, validating the new token map', async () => {
    const ok = await app.inject({
      method: 'PATCH',
      url: `/style-books/${styleBookId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Default Theme',
        tokens: { 'color-primary': '#cc3d47', 'radius-md': '6px' },
      },
    });
    expect(ok.statusCode).toBe(200);
    const body = ok.json() as { data: StyleBook };
    expect(body.data.name).toBe('Default Theme');
    expect(body.data.tokens).toEqual({ 'color-primary': '#cc3d47', 'radius-md': '6px' });

    const bad = await app.inject({
      method: 'PATCH',
      url: `/style-books/${styleBookId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { tokens: { has_underscore: '1px' } },
    });
    expect(bad.statusCode).toBe(400);
    expect((bad.json() as { detail: string }).detail).toContain('has_underscore');
  });

  it('publishes: sets PUBLISHED and increments the version', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/style-books/${styleBookId}/publish`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: StyleBook };
    expect(body.data.status).toBe('PUBLISHED');
    expect(body.data.version).toBe(2);

    const again = await app.inject({
      method: 'POST',
      url: `/style-books/${styleBookId}/publish`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(again.statusCode).toBe(200);
    expect((again.json() as { data: StyleBook }).data.version).toBe(3);
  });

  it('serves /css as text/css with :root --nv- variables, outside the JSON envelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/style-books/${styleBookId}/css`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/css');
    expect(res.body).toBe(':root {\n  --nv-color-primary: #cc3d47;\n  --nv-radius-md: 6px;\n}\n');
    expect(res.body).not.toContain('"data"');
  });

  it('returns 404 for an unknown style book', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/style-books/erc:does-not-exist',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('denies every endpoint for a role without style-book grants', async () => {
    const cases: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; url: string }[] = [
      { method: 'GET', url: '/style-books' },
      { method: 'GET', url: `/style-books/${styleBookId}` },
      { method: 'POST', url: '/style-books' },
      { method: 'PATCH', url: `/style-books/${styleBookId}` },
      { method: 'DELETE', url: `/style-books/${styleBookId}` },
      { method: 'POST', url: `/style-books/${styleBookId}/publish` },
      { method: 'GET', url: `/style-books/${styleBookId}/css` },
    ];
    for (const c of cases) {
      const res = await app.inject({
        method: c.method,
        url: c.url,
        headers: { authorization: `Bearer ${editorToken}` },
        ...(c.method === 'POST' || c.method === 'PATCH'
          ? { payload: { name: 'X', tokens: {} } }
          : {}),
      });
      expect(res.statusCode).toBe(403);
      expect(res.headers['content-type']).toContain('application/problem+json');
    }
  });

  it('deletes a style book with 204', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/style-books/${styleBookId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(204);

    const gone = await app.inject({
      method: 'GET',
      url: `/style-books/${styleBookId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(gone.statusCode).toBe(404);
  });
});
