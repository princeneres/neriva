import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './utils/test-app';
import { startTestDb, type TestDb } from './utils/test-db';

interface Tokens {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

describe('users, roles and permissions (e2e)', () => {
  let testDb: TestDb;
  let app: NestFastifyApplication;
  let adminToken: string;
  let viewerToken: string;
  let noRoleToken: string;
  let viewerRoleId: string;

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
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  it('lets admin create a role with scoped permissions', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/roles',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Viewer',
        description: 'Read-only access to users',
        permissions: [{ resourceType: 'user', action: 'read' }],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { data: { id: string; permissions: unknown[] } };
    viewerRoleId = body.data.id;
    expect(body.data.permissions).toEqual([{ resourceType: 'user', action: 'read' }]);
  });

  it('lets admin create users through the standard envelope', async () => {
    const viewer = await app.inject({
      method: 'POST',
      url: '/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        email: 'viewer@neriva.com',
        displayName: 'Viewer',
        password: 'viewer-temp-pass',
        roleIds: [viewerRoleId],
      },
    });
    expect(viewer.statusCode).toBe(201);
    const viewerBody = viewer.json() as { data: Record<string, unknown> };
    expect(viewerBody.data.mustChangePassword).toBe(true);
    expect(viewerBody.data).not.toHaveProperty('passwordHash');
    expect(viewerBody.data.tenantId).toBeTruthy();
    expect(viewerBody.data.externalReferenceCode).toBeTruthy();

    const noRole = await app.inject({
      method: 'POST',
      url: '/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { email: 'norole@neriva.com', displayName: 'No Role', password: 'norole-temp-pass' },
    });
    expect(noRole.statusCode).toBe(201);

    viewerToken = await loginFresh('viewer@neriva.com', 'viewer-temp-pass', 'viewer-final-pass');
    noRoleToken = await loginFresh('norole@neriva.com', 'norole-temp-pass', 'norole-final-pass');
  });

  it('allows the granted action for the viewer role', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/users',
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: unknown[]; meta: { cursor: string | null; limit: number } };
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.limit).toBe(20);
  });

  it('denies non-granted actions with 403 problem+json', async () => {
    const createUser = await app.inject({
      method: 'POST',
      url: '/users',
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: { email: 'x@neriva.com', displayName: 'X', password: 'whatever-pass' },
    });
    expect(createUser.statusCode).toBe(403);
    expect(createUser.headers['content-type']).toContain('application/problem+json');
    expect(createUser.json()).toMatchObject({
      status: 403,
      code: 'PERMISSION_DENIED',
      detail: 'Missing permission user:create',
    });

    const listRoles = await app.inject({
      method: 'GET',
      url: '/roles',
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(listRoles.statusCode).toBe(403);
  });

  it('denies everything for a user with no roles (deny by default)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/users',
      headers: { authorization: `Bearer ${noRoleToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('allows everything for the seeded Administrator wildcard', async () => {
    const usersRes = await app.inject({
      method: 'GET',
      url: '/users',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(usersRes.statusCode).toBe(200);

    const rolesRes = await app.inject({
      method: 'GET',
      url: '/roles',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(rolesRes.statusCode).toBe(200);
  });

  it('updates permissions atomically and reflects them immediately', async () => {
    const grant = await app.inject({
      method: 'PATCH',
      url: `/roles/${viewerRoleId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        permissions: [
          { resourceType: 'user', action: 'read' },
          { resourceType: 'role', action: 'read' },
        ],
      },
    });
    expect(grant.statusCode).toBe(200);

    const listRoles = await app.inject({
      method: 'GET',
      url: '/roles',
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(listRoles.statusCode).toBe(200);
  });

  it('supports role unassignment', async () => {
    const me = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    const viewerId = (me.json() as { data: { id: string } }).data.id;

    const unassign = await app.inject({
      method: 'DELETE',
      url: `/users/${viewerId}/roles/${viewerRoleId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(unassign.statusCode).toBe(204);

    const denied = await app.inject({
      method: 'GET',
      url: '/users',
      headers: { authorization: `Bearer ${viewerToken}` },
    });
    expect(denied.statusCode).toBe(403);
  });
});
