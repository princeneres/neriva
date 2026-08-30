import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './utils/test-app';
import { startTestDb, type TestDb } from './utils/test-db';

describe('API conventions (e2e)', () => {
  let testDb: TestDb;
  let app: NestFastifyApplication;
  let adminToken: string;

  beforeAll(async () => {
    testDb = await startTestDb();
    app = await createTestApp(testDb.connectionUri);

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'admin@neriva.com', password: 'admin' },
    });
    const first = (login.json() as { data: { accessToken: string } }).data.accessToken;
    const change = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      headers: { authorization: `Bearer ${first}` },
      payload: { currentPassword: 'admin', newPassword: 'conventions-pass' },
    });
    adminToken = (change.json() as { data: { accessToken: string } }).data.accessToken;
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  // The API shipped every response uncompressed until @fastify/compress was
  // registered. Nothing caught it because the payloads were still correct,
  // only three times larger than they needed to be, so these two lock the
  // behaviour and its threshold. Note they do NOT cover the plugin-ordering
  // half of the fix: app.init() here loads plugins early enough that even the
  // unawaited registration works, while a cold boot through main.ts does not.
  it('compresses a response above the size threshold', async () => {
    // /blocks returns the 16 seeded native blocks with their html and css, so
    // it is comfortably over the 1 KB threshold. Assert content-encoding and
    // not vary: the plugin sets vary on everything it inspects, including
    // responses it then decides to leave alone.
    const res = await app.inject({
      method: 'GET',
      url: '/blocks',
      headers: { authorization: `Bearer ${adminToken}`, 'accept-encoding': 'gzip' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.rawPayload.length).toBeGreaterThan(1024);
    expect(res.headers['content-encoding']).toBe('gzip');
  });

  it('leaves a response below the threshold uncompressed, since gzip would grow it', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'accept-encoding': 'gzip' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-encoding']).toBeUndefined();
  });

  it('resolves URL ids by UUID and by erc:<code>', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/roles',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Ref Test', externalReferenceCode: 'ref-test' },
    });
    expect(created.statusCode).toBe(201);
    const role = (created.json() as { data: { id: string } }).data;

    const byUuid = await app.inject({
      method: 'GET',
      url: `/roles/${role.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(byUuid.statusCode).toBe(200);

    const byErc = await app.inject({
      method: 'GET',
      url: '/roles/erc:ref-test',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(byErc.statusCode).toBe(200);
    expect((byErc.json() as { data: { id: string } }).data.id).toBe(role.id);
  });

  it('rejects malformed ids with 400 problem+json', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/roles/not-a-uuid',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('returns 404 problem+json for missing entities', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/roles/erc:does-not-exist',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ status: 404, title: 'Not Found' });
  });

  it('wraps success responses in the { data, meta } envelope', async () => {
    const single = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(Object.keys(single.json() as object)).toEqual(['data']);

    const list = await app.inject({
      method: 'GET',
      url: '/roles?limit=1',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const body = list.json() as { data: unknown[]; meta: { cursor: string | null; limit: number } };
    expect(body.data).toHaveLength(1);
    expect(body.meta.limit).toBe(1);
  });

  it('rejects an invalid cursor with 400 problem+json', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/roles?cursor=garbage',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });
});
