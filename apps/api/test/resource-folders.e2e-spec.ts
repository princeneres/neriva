import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './utils/test-app';
import { startTestDb, type TestDb } from './utils/test-db';

interface Tokens {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

describe('resource folders (e2e)', () => {
  let testDb: TestDb;
  let app: NestFastifyApplication;
  let adminToken: string;
  let folderId: string;

  async function loginFresh(): Promise<string> {
    const first = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'admin@neriva.com', password: 'admin' },
    });
    expect(first.statusCode).toBe(200);
    const firstToken = (first.json() as { data: Tokens }).data.accessToken;
    const change = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      headers: { authorization: `Bearer ${firstToken}` },
      payload: { currentPassword: 'admin', newPassword: 'folder-password-1' },
    });
    expect(change.statusCode).toBe(200);
    return (change.json() as { data: Tokens }).data.accessToken;
  }

  function asAdmin(options: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    url: string;
    payload?: Record<string, unknown>;
  }) {
    return app.inject({ ...options, headers: { authorization: `Bearer ${adminToken}` } });
  }

  beforeAll(async () => {
    testDb = await startTestDb();
    app = await createTestApp(testDb.connectionUri);
    adminToken = await loginFresh();
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  it('creates and lists folders by resource', async () => {
    const created = await asAdmin({
      method: 'POST',
      url: '/resource-folders',
      payload: {
        name: 'Marketing blocks',
        resource: 'blocks',
        externalReferenceCode: 'folder-blocks',
      },
    });
    expect(created.statusCode).toBe(201);
    folderId = (created.json() as { data: { id: string } }).data.id;

    const listed = await asAdmin({ method: 'GET', url: '/resource-folders?resource=blocks' });
    expect(listed.statusCode).toBe(200);
    expect((listed.json() as { data: { id: string }[] }).data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: folderId })]),
    );

    const otherResource = await asAdmin({
      method: 'GET',
      url: '/resource-folders?resource=objects',
    });
    expect(otherResource.statusCode).toBe(200);
    expect((otherResource.json() as { data: { id: string }[] }).data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: folderId })]),
    );
  });

  it('rejects duplicate names and cross-resource assignments', async () => {
    const duplicate = await asAdmin({
      method: 'POST',
      url: '/resource-folders',
      payload: { name: 'Marketing blocks', resource: 'blocks' },
    });
    expect(duplicate.statusCode).toBe(409);

    const object = await asAdmin({
      method: 'POST',
      url: '/object-definitions',
      payload: {
        name: 'Folder test object',
        pluralName: 'Folder test objects',
        fields: [{ key: 'name', label: 'Name', type: 'text', required: false }],
      },
    });
    expect(object.statusCode).toBe(201);
    const objectId = (object.json() as { data: { id: string } }).data.id;

    const wrongFolder = await asAdmin({
      method: 'PATCH',
      url: `/object-definitions/${objectId}`,
      payload: { folderId },
    });
    expect(wrongFolder.statusCode).toBe(404);
  });

  it('assigns a block and clears its assignment when the folder is deleted', async () => {
    const block = await asAdmin({
      method: 'POST',
      url: '/blocks',
      payload: {
        name: 'Folder test block',
        propsSchema: { type: 'object', properties: {} },
        folderId,
      },
    });
    expect(block.statusCode).toBe(201);
    const blockId = (block.json() as { data: { id: string; folderId: string | null } }).data.id;
    expect((block.json() as { data: { folderId: string | null } }).data.folderId).toBe(folderId);

    const deleted = await asAdmin({ method: 'DELETE', url: `/resource-folders/${folderId}` });
    expect(deleted.statusCode).toBe(204);

    const fetched = await asAdmin({ method: 'GET', url: `/blocks/${blockId}` });
    expect(fetched.statusCode).toBe(200);
    expect((fetched.json() as { data: { folderId: string | null } }).data.folderId).toBeNull();
  });
});
