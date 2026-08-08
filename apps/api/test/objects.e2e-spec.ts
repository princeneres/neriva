import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './utils/test-app';
import { startTestDb, type TestDb } from './utils/test-db';

interface Tokens {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

interface DefinitionData {
  id: string;
  externalReferenceCode: string;
  tenantId: string;
  name: string;
  pluralName: string;
  description: string | null;
  fields: { key: string; type: string }[];
}

interface RecordData {
  id: string;
  externalReferenceCode: string;
  tenantId: string;
  objectDefinitionId: string;
  data: Record<string, unknown>;
}

interface ListMeta {
  cursor: string | null;
  limit: number;
}

const TICKET_FIELDS = [
  { key: 'title', label: 'Title', type: 'text', required: true },
  { key: 'severity', label: 'Severity', type: 'number', required: false },
  { key: 'open', label: 'Open', type: 'boolean', required: false },
  { key: 'dueDate', label: 'Due date', type: 'date', required: false },
  { key: 'status', label: 'Status', type: 'picklist', required: false, options: ['new', 'done'] },
];

describe('objects (e2e)', () => {
  let testDb: TestDb;
  let app: NestFastifyApplication;
  let adminToken: string;
  let restrictedToken: string;
  let definitionId: string;
  let recordIds: string[] = [];

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
    adminToken = await loginFresh('admin@neriva.com', 'admin', 'admin-password-1');

    // A user whose only role has no object grants at all.
    const role = await asAdmin({
      method: 'POST',
      url: '/roles',
      payload: {
        name: 'No Objects',
        permissions: [{ resourceType: 'user', action: 'read' }],
      },
    });
    expect(role.statusCode).toBe(201);
    const roleId = (role.json() as { data: { id: string } }).data.id;
    const user = await asAdmin({
      method: 'POST',
      url: '/users',
      payload: {
        email: 'noobjects@neriva.com',
        displayName: 'No Objects',
        password: 'noobjects-temp-pass',
        roleIds: [roleId],
      },
    });
    expect(user.statusCode).toBe(201);
    restrictedToken = await loginFresh(
      'noobjects@neriva.com',
      'noobjects-temp-pass',
      'noobjects-final-pass',
    );
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  describe('definition CRUD', () => {
    it('creates a definition with the standard envelope', async () => {
      const res = await asAdmin({
        method: 'POST',
        url: '/object-definitions',
        payload: {
          name: 'Ticket',
          pluralName: 'Tickets',
          description: 'Support tickets',
          externalReferenceCode: 'ticket-def',
          fields: TICKET_FIELDS,
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json() as { data: DefinitionData };
      definitionId = body.data.id;
      expect(body.data.externalReferenceCode).toBe('ticket-def');
      expect(body.data.tenantId).toBeTruthy();
      expect(body.data.fields).toHaveLength(5);
    });

    it('gets a definition by id and by erc', async () => {
      const byId = await asAdmin({ method: 'GET', url: `/object-definitions/${definitionId}` });
      expect(byId.statusCode).toBe(200);
      const byErc = await asAdmin({ method: 'GET', url: '/object-definitions/erc:ticket-def' });
      expect(byErc.statusCode).toBe(200);
      expect((byErc.json() as { data: DefinitionData }).data.id).toBe(definitionId);
    });

    it('lists definitions with the list envelope', async () => {
      const res = await asAdmin({ method: 'GET', url: '/object-definitions' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { data: DefinitionData[]; meta: ListMeta };
      expect(body.data.some((d) => d.id === definitionId)).toBe(true);
      expect(body.meta.limit).toBe(20);
    });

    it('updates a definition', async () => {
      const res = await asAdmin({
        method: 'PATCH',
        url: `/object-definitions/${definitionId}`,
        payload: { description: 'Support tickets v2' },
      });
      expect(res.statusCode).toBe(200);
      expect((res.json() as { data: DefinitionData }).data.description).toBe('Support tickets v2');
    });

    it('rejects duplicate field keys with 400', async () => {
      const res = await asAdmin({
        method: 'POST',
        url: '/object-definitions',
        payload: {
          name: 'Broken',
          pluralName: 'Brokens',
          fields: [
            { key: 'a', label: 'A', type: 'text', required: false },
            { key: 'a', label: 'B', type: 'text', required: false },
          ],
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects a picklist without options with 400', async () => {
      const res = await asAdmin({
        method: 'POST',
        url: '/object-definitions',
        payload: {
          name: 'Broken',
          pluralName: 'Brokens',
          fields: [{ key: 'status', label: 'Status', type: 'picklist', required: false }],
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects invalid field keys with 400', async () => {
      const res = await asAdmin({
        method: 'POST',
        url: '/object-definitions',
        payload: {
          name: 'Broken',
          pluralName: 'Brokens',
          fields: [{ key: 'Not-Valid', label: 'X', type: 'text', required: false }],
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects a duplicate definition name with 409 problem+json', async () => {
      const res = await asAdmin({
        method: 'POST',
        url: '/object-definitions',
        payload: { name: 'Ticket', pluralName: 'Tickets', fields: TICKET_FIELDS },
      });
      expect(res.statusCode).toBe(409);
      expect(res.headers['content-type']).toContain('application/problem+json');
    });
  });

  describe('record CRUD and data validation', () => {
    it('creates records', async () => {
      const payloads = [
        { title: 'Server down', severity: 10, open: true, status: 'new', dueDate: '2026-01-15' },
        { title: 'Typo on homepage', severity: 1, open: false, status: 'done' },
        { title: 'Slow queries', severity: 2, open: true, status: 'new' },
      ];
      recordIds = [];
      for (const data of payloads) {
        const res = await asAdmin({
          method: 'POST',
          url: '/object-definitions/erc:ticket-def/records',
          payload: { data },
        });
        expect(res.statusCode).toBe(201);
        const body = res.json() as { data: RecordData };
        expect(body.data.objectDefinitionId).toBe(definitionId);
        expect(body.data.tenantId).toBeTruthy();
        recordIds.push(body.data.id);
      }
    });

    it('rejects unknown data keys with 400', async () => {
      const res = await asAdmin({
        method: 'POST',
        url: '/object-definitions/erc:ticket-def/records',
        payload: { data: { title: 'X', nope: 1 } },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects a missing required field with 400', async () => {
      const res = await asAdmin({
        method: 'POST',
        url: '/object-definitions/erc:ticket-def/records',
        payload: { data: { severity: 5 } },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects wrong value types with 400', async () => {
      const res = await asAdmin({
        method: 'POST',
        url: '/object-definitions/erc:ticket-def/records',
        payload: { data: { title: 'X', severity: 'high' } },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects picklist values outside the options with 400', async () => {
      const res = await asAdmin({
        method: 'POST',
        url: '/object-definitions/erc:ticket-def/records',
        payload: { data: { title: 'X', status: 'archived' } },
      });
      expect(res.statusCode).toBe(400);
    });

    it('gets a record by id', async () => {
      const res = await asAdmin({ method: 'GET', url: `/object-records/${recordIds[0]}` });
      expect(res.statusCode).toBe(200);
      expect((res.json() as { data: RecordData }).data.data.title).toBe('Server down');
    });

    it('updates record data with validation', async () => {
      const ok = await asAdmin({
        method: 'PATCH',
        url: `/object-records/${recordIds[1]}`,
        payload: { data: { title: 'Typo on homepage', severity: 1, open: false, status: 'new' } },
      });
      expect(ok.statusCode).toBe(200);
      expect((ok.json() as { data: RecordData }).data.data.status).toBe('new');

      const invalid = await asAdmin({
        method: 'PATCH',
        url: `/object-records/${recordIds[1]}`,
        payload: { data: { title: 'Typo on homepage', status: 'archived' } },
      });
      expect(invalid.statusCode).toBe(400);

      const back = await asAdmin({
        method: 'PATCH',
        url: `/object-records/${recordIds[1]}`,
        payload: { data: { title: 'Typo on homepage', severity: 1, open: false, status: 'done' } },
      });
      expect(back.statusCode).toBe(200);
    });

    it('deletes a record', async () => {
      const extra = await asAdmin({
        method: 'POST',
        url: '/object-definitions/erc:ticket-def/records',
        payload: { data: { title: 'Temp' } },
      });
      expect(extra.statusCode).toBe(201);
      const id = (extra.json() as { data: RecordData }).data.id;
      const del = await asAdmin({ method: 'DELETE', url: `/object-records/${id}` });
      expect(del.statusCode).toBe(204);
      const gone = await asAdmin({ method: 'GET', url: `/object-records/${id}` });
      expect(gone.statusCode).toBe(404);
    });
  });

  describe('dynamic filtering and sorting', () => {
    function listRecords(query: string) {
      return asAdmin({
        method: 'GET',
        url: `/object-definitions/erc:ticket-def/records${query}`,
      });
    }

    it('filters by a text (picklist) field', async () => {
      const res = await listRecords('?filter[status]=new');
      expect(res.statusCode).toBe(200);
      const body = res.json() as { data: RecordData[] };
      expect(body.data).toHaveLength(2);
      expect(body.data.every((r) => r.data.status === 'new')).toBe(true);
    });

    it('filters by a number field with coercion', async () => {
      const res = await listRecords('?filter[severity]=10');
      expect(res.statusCode).toBe(200);
      const body = res.json() as { data: RecordData[] };
      expect(body.data).toHaveLength(1);
      expect(body.data[0]!.data.title).toBe('Server down');
    });

    it('filters by a boolean field with coercion', async () => {
      const res = await listRecords('?filter[open]=true');
      expect(res.statusCode).toBe(200);
      const body = res.json() as { data: RecordData[] };
      expect(body.data).toHaveLength(2);
      expect(body.data.every((r) => r.data.open === true)).toBe(true);
    });

    it('ANDs multiple filters', async () => {
      const res = await listRecords('?filter[open]=true&filter[status]=new&filter[severity]=2');
      expect(res.statusCode).toBe(200);
      const body = res.json() as { data: RecordData[] };
      expect(body.data).toHaveLength(1);
      expect(body.data[0]!.data.title).toBe('Slow queries');
    });

    it('returns 400 for an unknown filter key', async () => {
      const res = await listRecords('?filter[nope]=x');
      expect(res.statusCode).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
    });

    it('returns 400 for a non-numeric value on a number field', async () => {
      const res = await listRecords('?filter[severity]=high');
      expect(res.statusCode).toBe(400);
    });

    it('sorts ascending and descending by a number field', async () => {
      const asc = await listRecords('?sort=severity');
      expect(asc.statusCode).toBe(200);
      const ascSeverities = (asc.json() as { data: RecordData[] }).data.map((r) => r.data.severity);
      expect(ascSeverities).toEqual([1, 2, 10]);

      const desc = await listRecords('?sort=-severity');
      expect(desc.statusCode).toBe(200);
      const descSeverities = (desc.json() as { data: RecordData[] }).data.map(
        (r) => r.data.severity,
      );
      expect(descSeverities).toEqual([10, 2, 1]);
    });

    it('returns 400 for an unknown sort field', async () => {
      const res = await listRecords('?sort=nope');
      expect(res.statusCode).toBe(400);
    });

    it('paginates with the default id sort', async () => {
      const first = await listRecords('?limit=2');
      expect(first.statusCode).toBe(200);
      const firstBody = first.json() as { data: RecordData[]; meta: ListMeta };
      expect(firstBody.data).toHaveLength(2);
      expect(firstBody.meta.cursor).toBeTruthy();

      const second = await listRecords(`?limit=2&cursor=${firstBody.meta.cursor}`);
      expect(second.statusCode).toBe(200);
      const secondBody = second.json() as { data: RecordData[]; meta: ListMeta };
      expect(secondBody.data).toHaveLength(1);
      expect(secondBody.meta.cursor).toBeNull();
      const ids = [...firstBody.data, ...secondBody.data].map((r) => r.id);
      expect(new Set(ids).size).toBe(3);
    });

    it('returns 400 when sort is combined with cursor', async () => {
      const first = await listRecords('?limit=2');
      const cursor = (first.json() as { meta: ListMeta }).meta.cursor;
      const res = await listRecords(`?sort=severity&cursor=${cursor}`);
      expect(res.statusCode).toBe(400);
    });
  });

  describe('definition deletion protection', () => {
    it('returns 409 when the definition still has records', async () => {
      const res = await asAdmin({
        method: 'DELETE',
        url: `/object-definitions/${definitionId}`,
      });
      expect(res.statusCode).toBe(409);
      expect(res.headers['content-type']).toContain('application/problem+json');
    });

    it('deletes the definition once its records are gone', async () => {
      for (const id of recordIds) {
        const del = await asAdmin({ method: 'DELETE', url: `/object-records/${id}` });
        expect(del.statusCode).toBe(204);
      }
      const res = await asAdmin({
        method: 'DELETE',
        url: `/object-definitions/${definitionId}`,
      });
      expect(res.statusCode).toBe(204);
    });
  });

  describe('permissions', () => {
    it('denies object endpoints to a role with no object grants', async () => {
      const cases = [
        { method: 'GET' as const, url: '/object-definitions' },
        {
          method: 'POST' as const,
          url: '/object-definitions',
          payload: { name: 'X', pluralName: 'Xs', fields: [] },
        },
        { method: 'GET' as const, url: '/object-definitions/erc:whatever/records' },
        {
          method: 'POST' as const,
          url: '/object-definitions/erc:whatever/records',
          payload: { data: {} },
        },
      ];
      for (const request of cases) {
        const res = await app.inject({
          ...request,
          headers: { authorization: `Bearer ${restrictedToken}` },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json()).toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });
      }
    });
  });
});
