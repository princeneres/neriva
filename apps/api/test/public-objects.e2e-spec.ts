import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './utils/test-app';
import { startTestDb, type TestDb } from './utils/test-db';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

interface DefinitionData {
  id: string;
  externalReferenceCode: string;
  publicAccess: 'none' | 'read' | 'read-write';
}

interface PublicDefinitionData {
  id: string;
  externalReferenceCode: string;
  name: string;
  pluralName: string;
  description: string | null;
  publicAccess: 'read' | 'read-write';
  fields: { key: string }[];
}

interface PublicRecordData {
  id: string;
  externalReferenceCode: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const TASK_FIELDS = [
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'done', label: 'Done', type: 'boolean', required: false },
];

// Every public write in this suite spends from the same per-IP budget, so the
// counts here stay comfortably under PUBLIC_WRITE_THROTTLE (20/min) and the
// rate limit test runs last, after the budget no longer matters.
describe('public objects (e2e)', () => {
  let testDb: TestDb;
  let app: NestFastifyApplication;
  let adminToken: string;
  let privateDef: DefinitionData;
  let readDef: DefinitionData;
  let writeDef: DefinitionData;

  async function loginFresh(): Promise<string> {
    const first = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'admin@neriva.com', password: 'admin' },
    });
    expect(first.statusCode).toBe(200);
    const change = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      headers: {
        authorization: `Bearer ${(first.json() as { data: Tokens }).data.accessToken}`,
      },
      payload: { currentPassword: 'admin', newPassword: 'admin-password-1' },
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

  // No headers at all: an anonymous visitor's request.
  function anonymous(options: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    url: string;
    payload?: Record<string, unknown>;
  }) {
    return app.inject(options);
  }

  async function createDefinition(
    name: string,
    erc: string,
    publicAccess?: 'none' | 'read' | 'read-write',
  ): Promise<DefinitionData> {
    const res = await asAdmin({
      method: 'POST',
      url: '/object-definitions',
      payload: {
        name,
        pluralName: `${name}s`,
        externalReferenceCode: erc,
        fields: TASK_FIELDS,
        ...(publicAccess ? { publicAccess } : {}),
      },
    });
    expect(res.statusCode).toBe(201);
    return (res.json() as { data: DefinitionData }).data;
  }

  async function createRecord(defErc: string, title: string): Promise<string> {
    const res = await asAdmin({
      method: 'POST',
      url: `/object-definitions/erc:${defErc}/records`,
      payload: { data: { title, done: false } },
    });
    expect(res.statusCode).toBe(201);
    return (res.json() as { data: { id: string } }).data.id;
  }

  beforeAll(async () => {
    testDb = await startTestDb();
    app = await createTestApp(testDb.connectionUri);
    adminToken = await loginFresh();

    privateDef = await createDefinition('Secret', 'public-secret');
    readDef = await createDefinition('Catalogue', 'public-catalogue', 'read');
    writeDef = await createDefinition('Shared list', 'public-shared', 'read-write');

    await createRecord('public-secret', 'Classified');
    await createRecord('public-catalogue', 'Listed item');
    await createRecord('public-shared', 'Seeded task');
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  describe('the default is private', () => {
    it('creates definitions private unless publicAccess is passed', () => {
      expect(privateDef.publicAccess).toBe('none');
    });

    it('hides a private definition from anonymous callers, as if it did not exist', async () => {
      const byErc = await anonymous({
        method: 'GET',
        url: '/public/object-definitions/erc:public-secret',
      });
      expect(byErc.statusCode).toBe(404);
      expect(byErc.headers['content-type']).toContain('application/problem+json');

      const byId = await anonymous({
        method: 'GET',
        url: `/public/object-definitions/${privateDef.id}`,
      });
      expect(byId.statusCode).toBe(404);

      // The 404 for a private object is indistinguishable from the 404 for one
      // that was never created: no existence oracle.
      const missing = await anonymous({
        method: 'GET',
        url: '/public/object-definitions/erc:no-such-object',
      });
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toMatchObject({ status: 404 });
    });

    it('hides a private definition’s records from anonymous callers', async () => {
      const res = await anonymous({
        method: 'GET',
        url: '/public/object-definitions/erc:public-secret/records',
      });
      expect(res.statusCode).toBe(404);
    });

    it('refuses an anonymous write to a private definition', async () => {
      const res = await anonymous({
        method: 'POST',
        url: '/public/object-definitions/erc:public-secret/records',
        payload: { data: { title: 'Injected' } },
      });
      expect(res.statusCode).toBe(404);
    });

    it('still requires a token on the management endpoints', async () => {
      const definition = await anonymous({
        method: 'GET',
        url: '/object-definitions/erc:public-shared',
      });
      expect(definition.statusCode).toBe(401);
      const records = await anonymous({
        method: 'GET',
        url: '/object-definitions/erc:public-shared/records',
      });
      expect(records.statusCode).toBe(401);
    });

    it('never lists definitions anonymously', async () => {
      // /public/object-definitions with no reference is not a route, so a
      // visitor cannot enumerate the data model.
      const res = await anonymous({ method: 'GET', url: '/public/object-definitions' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('read mode', () => {
    it('serves the definition without the management envelope', async () => {
      const res = await anonymous({
        method: 'GET',
        url: '/public/object-definitions/erc:public-catalogue',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { data: PublicDefinitionData & Record<string, unknown> };
      expect(body.data.name).toBe('Catalogue');
      expect(body.data.publicAccess).toBe('read');
      expect(body.data.fields.map((field) => field.key)).toEqual(['title', 'done']);
      expect(body.data).not.toHaveProperty('tenantId');
      expect(body.data).not.toHaveProperty('createdBy');
      expect(body.data).not.toHaveProperty('folderId');
    });

    it('lists the records without the management envelope', async () => {
      const res = await anonymous({
        method: 'GET',
        url: '/public/object-definitions/erc:public-catalogue/records',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { data: PublicRecordData[]; meta: { limit: number } };
      expect(body.data).toHaveLength(1);
      expect(body.data[0]?.data).toMatchObject({ title: 'Listed item' });
      expect(body.data[0]).not.toHaveProperty('tenantId');
      expect(body.data[0]).not.toHaveProperty('createdBy');
      expect(body.data[0]).not.toHaveProperty('objectDefinitionId');
      expect(body.meta.limit).toBe(20);
    });

    it('supports the same filtering as the management listing', async () => {
      const res = await anonymous({
        method: 'GET',
        url: '/public/object-definitions/erc:public-catalogue/records?filter[done]=true',
      });
      expect(res.statusCode).toBe(200);
      expect((res.json() as { data: PublicRecordData[] }).data).toHaveLength(0);

      const unknown = await anonymous({
        method: 'GET',
        url: '/public/object-definitions/erc:public-catalogue/records?filter[nope]=1',
      });
      expect(unknown.statusCode).toBe(400);
    });

    it('refuses anonymous creates with 403, not a silent success', async () => {
      const res = await anonymous({
        method: 'POST',
        url: '/public/object-definitions/erc:public-catalogue/records',
        payload: { data: { title: 'Spam' } },
      });
      expect(res.statusCode).toBe(403);

      const after = await anonymous({
        method: 'GET',
        url: '/public/object-definitions/erc:public-catalogue/records',
      });
      expect((after.json() as { data: PublicRecordData[] }).data).toHaveLength(1);
    });

    it('refuses anonymous updates and deletes on a read-only definition', async () => {
      const list = await anonymous({
        method: 'GET',
        url: '/public/object-definitions/erc:public-catalogue/records',
      });
      const recordId = (list.json() as { data: PublicRecordData[] }).data[0]?.id ?? '';
      const patch = await anonymous({
        method: 'PATCH',
        url: `/public/object-definitions/erc:public-catalogue/records/${recordId}`,
        payload: { data: { title: 'Defaced' } },
      });
      expect(patch.statusCode).toBe(403);
      const del = await anonymous({
        method: 'DELETE',
        url: `/public/object-definitions/erc:public-catalogue/records/${recordId}`,
      });
      expect(del.statusCode).toBe(403);
    });
  });

  describe('read-write mode', () => {
    it('lets an anonymous visitor create, list, update and delete a record', async () => {
      const created = await anonymous({
        method: 'POST',
        url: '/public/object-definitions/erc:public-shared/records',
        payload: { data: { title: 'Added while signed out', done: false } },
      });
      expect(created.statusCode).toBe(201);
      const record = (created.json() as { data: PublicRecordData }).data;
      expect(record.data).toMatchObject({ title: 'Added while signed out' });

      const list = await anonymous({
        method: 'GET',
        url: '/public/object-definitions/erc:public-shared/records',
      });
      expect((list.json() as { data: PublicRecordData[] }).data).toHaveLength(2);

      const updated = await anonymous({
        method: 'PATCH',
        url: `/public/object-definitions/erc:public-shared/records/${record.id}`,
        payload: { data: { title: 'Added while signed out', done: true } },
      });
      expect(updated.statusCode).toBe(200);
      expect((updated.json() as { data: PublicRecordData }).data.data).toMatchObject({
        done: true,
      });

      const deleted = await anonymous({
        method: 'DELETE',
        url: `/public/object-definitions/erc:public-shared/records/${record.id}`,
      });
      expect(deleted.statusCode).toBe(204);

      const after = await anonymous({
        method: 'GET',
        url: '/public/object-definitions/erc:public-shared/records',
      });
      expect((after.json() as { data: PublicRecordData[] }).data).toHaveLength(1);
    });

    it('attributes an anonymous record to nobody', async () => {
      const created = await anonymous({
        method: 'POST',
        url: '/public/object-definitions/erc:public-shared/records',
        payload: { data: { title: 'Unattributed' } },
      });
      expect(created.statusCode).toBe(201);
      const id = (created.json() as { data: PublicRecordData }).data.id;
      const managed = await asAdmin({ method: 'GET', url: `/object-records/${id}` });
      expect(managed.statusCode).toBe(200);
      expect((managed.json() as { data: { createdBy: string | null } }).data.createdBy).toBeNull();
      await asAdmin({ method: 'DELETE', url: `/object-records/${id}` });
    });

    it('ignores an externalReferenceCode sent by an anonymous caller', async () => {
      const created = await anonymous({
        method: 'POST',
        url: '/public/object-definitions/erc:public-shared/records',
        payload: { data: { title: 'ERC squat' }, externalReferenceCode: 'squatted-code' },
      });
      expect(created.statusCode).toBe(201);
      const record = (created.json() as { data: PublicRecordData }).data;
      expect(record.externalReferenceCode).not.toBe('squatted-code');
      await asAdmin({ method: 'DELETE', url: `/object-records/${record.id}` });
    });

    it('still validates the payload against the definition fields', async () => {
      const unknownKey = await anonymous({
        method: 'POST',
        url: '/public/object-definitions/erc:public-shared/records',
        payload: { data: { title: 'x', nope: 1 } },
      });
      expect(unknownKey.statusCode).toBe(400);

      const missingRequired = await anonymous({
        method: 'POST',
        url: '/public/object-definitions/erc:public-shared/records',
        payload: { data: { done: true } },
      });
      expect(missingRequired.statusCode).toBe(400);
    });

    it('rejects an oversized anonymous payload', async () => {
      const res = await anonymous({
        method: 'POST',
        url: '/public/object-definitions/erc:public-shared/records',
        payload: { data: { title: 'a'.repeat(5000) } },
      });
      expect(res.statusCode).toBe(400);
      expect((res.json() as { detail: string }).detail).toContain('limit');
    });
  });

  describe('isolation between definitions', () => {
    it('does not let a read-write definition reach another definition’s records', async () => {
      const secretRecords = await asAdmin({
        method: 'GET',
        url: '/object-definitions/erc:public-secret/records',
      });
      const secretId = (secretRecords.json() as { data: { id: string }[] }).data[0]?.id ?? '';

      const patch = await anonymous({
        method: 'PATCH',
        url: `/public/object-definitions/erc:public-shared/records/${secretId}`,
        payload: { data: { title: 'Cross-object write' } },
      });
      expect(patch.statusCode).toBe(404);

      const del = await anonymous({
        method: 'DELETE',
        url: `/public/object-definitions/erc:public-shared/records/${secretId}`,
      });
      expect(del.statusCode).toBe(404);

      const stillThere = await asAdmin({ method: 'GET', url: `/object-records/${secretId}` });
      expect(stillThere.statusCode).toBe(200);
      expect((stillThere.json() as { data: { data: { title: string } } }).data.data.title).toBe(
        'Classified',
      );
    });

    it('does not leak another definition’s records through the public listing', async () => {
      const res = await anonymous({
        method: 'GET',
        url: '/public/object-definitions/erc:public-shared/records?limit=100',
      });
      const titles = (res.json() as { data: PublicRecordData[] }).data.map(
        (item) => item.data.title,
      );
      expect(titles).not.toContain('Classified');
      expect(titles).not.toContain('Listed item');
    });
  });

  describe('turning access off again', () => {
    it('closes the public surface as soon as the mode goes back to none', async () => {
      const patched = await asAdmin({
        method: 'PATCH',
        url: `/object-definitions/${readDef.id}`,
        payload: { publicAccess: 'none' },
      });
      expect(patched.statusCode).toBe(200);
      expect((patched.json() as { data: DefinitionData }).data.publicAccess).toBe('none');

      const res = await anonymous({
        method: 'GET',
        url: '/public/object-definitions/erc:public-catalogue/records',
      });
      expect(res.statusCode).toBe(404);

      // Restore it so the ordering of this file stays independent.
      await asAdmin({
        method: 'PATCH',
        url: `/object-definitions/${readDef.id}`,
        payload: { publicAccess: 'read' },
      });
    });

    it('rejects an unknown access mode', async () => {
      const res = await asAdmin({
        method: 'PATCH',
        url: `/object-definitions/${writeDef.id}`,
        payload: { publicAccess: 'everyone' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // Keep last in the file: it exhausts the per-IP public write budget.
  describe('anonymous write rate limiting', () => {
    it('throttles anonymous writes with 429 problem+json', async () => {
      const createdIds: string[] = [];
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const res = await anonymous({
          method: 'POST',
          url: '/public/object-definitions/erc:public-shared/records',
          payload: { data: { title: `Flood ${attempt}` } },
        });
        if (res.statusCode === 429) {
          expect(res.headers['content-type']).toContain('application/problem+json');
          expect(res.json()).toMatchObject({ status: 429, title: 'Too Many Requests' });
          for (const id of createdIds) {
            await asAdmin({ method: 'DELETE', url: `/object-records/${id}` });
          }
          return;
        }
        expect(res.statusCode).toBe(201);
        createdIds.push((res.json() as { data: PublicRecordData }).data.id);
      }
      throw new Error('Expected a 429 within 40 rapid anonymous writes');
    });

    it('leaves anonymous reads working after the write budget is spent', async () => {
      const res = await anonymous({
        method: 'GET',
        url: '/public/object-definitions/erc:public-shared/records',
      });
      expect(res.statusCode).toBe(200);
    });
  });
});
