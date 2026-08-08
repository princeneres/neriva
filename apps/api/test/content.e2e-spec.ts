import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './utils/test-app';
import { startTestDb, type TestDb } from './utils/test-db';

interface Tokens {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

interface ContentTypeData {
  id: string;
  externalReferenceCode: string;
  tenantId: string;
  name: string;
  description: string | null;
  fields: { key: string; label: string; type: string; required: boolean }[];
}

interface ContentEntryData {
  id: string;
  externalReferenceCode: string;
  tenantId: string;
  status: string;
  contentTypeId: string;
  siteId: string | null;
  title: string;
  values: Record<string, unknown>;
  customFields: Record<string, unknown>;
}

interface ListMeta {
  cursor: string | null;
  limit: number;
}

const ARTICLE_FIELDS = [
  { key: 'headline', label: 'Headline', type: 'text', required: true },
  { key: 'body', label: 'Body', type: 'richtext', required: false },
  { key: 'rating', label: 'Rating', type: 'number', required: false },
  { key: 'featured', label: 'Featured', type: 'boolean', required: false },
  { key: 'publishedOn', label: 'Published on', type: 'date', required: false },
];

describe('content (e2e)', () => {
  let testDb: TestDb;
  let app: NestFastifyApplication;
  let adminToken: string;
  let restrictedToken: string;
  let contentTypeId: string;
  let siteId: string;
  let entryIds: string[] = [];

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

    const site = await asAdmin({
      method: 'POST',
      url: '/sites',
      payload: { name: 'Marketing', slug: 'marketing', externalReferenceCode: 'marketing-site' },
    });
    expect(site.statusCode).toBe(201);
    siteId = (site.json() as { data: { id: string } }).data.id;

    // A user whose only role has no content grants at all.
    const role = await asAdmin({
      method: 'POST',
      url: '/roles',
      payload: {
        name: 'No Content',
        permissions: [{ resourceType: 'user', action: 'read' }],
      },
    });
    expect(role.statusCode).toBe(201);
    const roleId = (role.json() as { data: { id: string } }).data.id;
    const user = await asAdmin({
      method: 'POST',
      url: '/users',
      payload: {
        email: 'nocontent@neriva.com',
        displayName: 'No Content',
        password: 'nocontent-temp-pass',
        roleIds: [roleId],
      },
    });
    expect(user.statusCode).toBe(201);
    restrictedToken = await loginFresh(
      'nocontent@neriva.com',
      'nocontent-temp-pass',
      'nocontent-final-pass',
    );
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  describe('content type CRUD', () => {
    it('creates a content type with the standard envelope', async () => {
      const res = await asAdmin({
        method: 'POST',
        url: '/content-types',
        payload: {
          name: 'Article',
          description: 'News articles',
          externalReferenceCode: 'article-type',
          fields: ARTICLE_FIELDS,
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json() as { data: ContentTypeData };
      contentTypeId = body.data.id;
      expect(body.data.externalReferenceCode).toBe('article-type');
      expect(body.data.tenantId).toBeTruthy();
      expect(body.data.fields).toHaveLength(5);
    });

    it('defaults field required to false when omitted', async () => {
      const res = await asAdmin({
        method: 'POST',
        url: '/content-types',
        payload: {
          name: 'Note',
          externalReferenceCode: 'note-type',
          fields: [{ key: 'text', label: 'Text', type: 'text' }],
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json() as { data: ContentTypeData };
      expect(body.data.fields[0]!.required).toBe(false);
    });

    it('gets a content type by id and by erc', async () => {
      const byId = await asAdmin({ method: 'GET', url: `/content-types/${contentTypeId}` });
      expect(byId.statusCode).toBe(200);
      const byErc = await asAdmin({ method: 'GET', url: '/content-types/erc:article-type' });
      expect(byErc.statusCode).toBe(200);
      expect((byErc.json() as { data: ContentTypeData }).data.id).toBe(contentTypeId);
    });

    it('lists content types with the list envelope', async () => {
      const res = await asAdmin({ method: 'GET', url: '/content-types' });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { data: ContentTypeData[]; meta: ListMeta };
      expect(body.data.some((t) => t.id === contentTypeId)).toBe(true);
      expect(body.meta.limit).toBe(20);
    });

    it('updates a content type', async () => {
      const res = await asAdmin({
        method: 'PATCH',
        url: `/content-types/${contentTypeId}`,
        payload: { description: 'News articles v2' },
      });
      expect(res.statusCode).toBe(200);
      expect((res.json() as { data: ContentTypeData }).data.description).toBe('News articles v2');
    });

    it('rejects duplicate field keys with 400', async () => {
      const res = await asAdmin({
        method: 'POST',
        url: '/content-types',
        payload: {
          name: 'Broken',
          fields: [
            { key: 'a', label: 'A', type: 'text' },
            { key: 'a', label: 'B', type: 'text' },
          ],
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects invalid field keys with 400', async () => {
      const res = await asAdmin({
        method: 'POST',
        url: '/content-types',
        payload: {
          name: 'Broken',
          fields: [{ key: 'Not-Valid', label: 'X', type: 'text' }],
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects unknown field types with 400', async () => {
      const res = await asAdmin({
        method: 'POST',
        url: '/content-types',
        payload: {
          name: 'Broken',
          fields: [{ key: 'status', label: 'Status', type: 'picklist' }],
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects a duplicate content type name with 409 problem+json', async () => {
      const res = await asAdmin({
        method: 'POST',
        url: '/content-types',
        payload: { name: 'Article', fields: ARTICLE_FIELDS },
      });
      expect(res.statusCode).toBe(409);
      expect(res.headers['content-type']).toContain('application/problem+json');
    });
  });

  describe('content entry CRUD and values validation', () => {
    it('creates entries against a type, tenant-wide and site-scoped', async () => {
      entryIds = [];
      const tenantWide = await asAdmin({
        method: 'POST',
        url: '/content-entries',
        payload: {
          contentType: 'erc:article-type',
          title: 'Launch day',
          values: { headline: 'We launched', rating: 5, publishedOn: '2026-08-01' },
        },
      });
      expect(tenantWide.statusCode).toBe(201);
      const first = (tenantWide.json() as { data: ContentEntryData }).data;
      expect(first.contentTypeId).toBe(contentTypeId);
      expect(first.siteId).toBeNull();
      expect(first.status).toBe('DRAFT');
      expect(first.tenantId).toBeTruthy();
      entryIds.push(first.id);

      const siteEntry = await asAdmin({
        method: 'POST',
        url: '/content-entries',
        payload: {
          contentType: contentTypeId,
          site: siteId,
          title: 'Marketing news',
          values: { headline: 'Site scoped', featured: true },
        },
      });
      expect(siteEntry.statusCode).toBe(201);
      const second = (siteEntry.json() as { data: ContentEntryData }).data;
      expect(second.siteId).toBe(siteId);
      entryIds.push(second.id);
    });

    it('returns 404 for an unknown content type ref', async () => {
      const res = await asAdmin({
        method: 'POST',
        url: '/content-entries',
        payload: { contentType: 'erc:nope', title: 'X', values: { headline: 'X' } },
      });
      expect(res.statusCode).toBe(404);
    });

    it('rejects unknown value keys with 400', async () => {
      const res = await asAdmin({
        method: 'POST',
        url: '/content-entries',
        payload: {
          contentType: 'erc:article-type',
          title: 'X',
          values: { headline: 'X', nope: 1 },
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects a missing required value with 400', async () => {
      const res = await asAdmin({
        method: 'POST',
        url: '/content-entries',
        payload: { contentType: 'erc:article-type', title: 'X', values: { rating: 5 } },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects wrong primitive types with 400', async () => {
      const res = await asAdmin({
        method: 'POST',
        url: '/content-entries',
        payload: {
          contentType: 'erc:article-type',
          title: 'X',
          values: { headline: 'X', rating: 'high' },
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects invalid ISO 8601 dates with 400', async () => {
      for (const publishedOn of ['tomorrow', '2026-02-30']) {
        const res = await asAdmin({
          method: 'POST',
          url: '/content-entries',
          payload: {
            contentType: 'erc:article-type',
            title: 'X',
            values: { headline: 'X', publishedOn },
          },
        });
        expect(res.statusCode).toBe(400);
      }
    });

    it('gets an entry by id', async () => {
      const res = await asAdmin({ method: 'GET', url: `/content-entries/${entryIds[0]}` });
      expect(res.statusCode).toBe(200);
      expect((res.json() as { data: ContentEntryData }).data.values.headline).toBe('We launched');
    });

    it('updates entry values with validation', async () => {
      const ok = await asAdmin({
        method: 'PATCH',
        url: `/content-entries/${entryIds[0]}`,
        payload: { title: 'Launch day v2', values: { headline: 'We launched, again' } },
      });
      expect(ok.statusCode).toBe(200);
      const body = ok.json() as { data: ContentEntryData };
      expect(body.data.title).toBe('Launch day v2');
      expect(body.data.values.headline).toBe('We launched, again');

      const invalid = await asAdmin({
        method: 'PATCH',
        url: `/content-entries/${entryIds[0]}`,
        payload: { values: { headline: 'X', rating: 'broken' } },
      });
      expect(invalid.statusCode).toBe(400);
    });

    it('detaches an entry from its site with site: null', async () => {
      const res = await asAdmin({
        method: 'PATCH',
        url: `/content-entries/${entryIds[1]}`,
        payload: { site: null },
      });
      expect(res.statusCode).toBe(200);
      expect((res.json() as { data: ContentEntryData }).data.siteId).toBeNull();

      const back = await asAdmin({
        method: 'PATCH',
        url: `/content-entries/${entryIds[1]}`,
        payload: { site: siteId },
      });
      expect(back.statusCode).toBe(200);
      expect((back.json() as { data: ContentEntryData }).data.siteId).toBe(siteId);
    });

    it('deletes an entry', async () => {
      const extra = await asAdmin({
        method: 'POST',
        url: '/content-entries',
        payload: { contentType: 'erc:article-type', title: 'Temp', values: { headline: 'T' } },
      });
      expect(extra.statusCode).toBe(201);
      const id = (extra.json() as { data: ContentEntryData }).data.id;
      const del = await asAdmin({ method: 'DELETE', url: `/content-entries/${id}` });
      expect(del.statusCode).toBe(204);
      const gone = await asAdmin({ method: 'GET', url: `/content-entries/${id}` });
      expect(gone.statusCode).toBe(404);
    });
  });

  describe('publish', () => {
    it('publishes a draft entry', async () => {
      const res = await asAdmin({
        method: 'POST',
        url: `/content-entries/${entryIds[0]}/publish`,
      });
      expect(res.statusCode).toBe(200);
      expect((res.json() as { data: ContentEntryData }).data.status).toBe('PUBLISHED');

      const fetched = await asAdmin({ method: 'GET', url: `/content-entries/${entryIds[0]}` });
      expect((fetched.json() as { data: ContentEntryData }).data.status).toBe('PUBLISHED');
    });
  });

  describe('list filters', () => {
    it('filters by contentType', async () => {
      const res = await asAdmin({
        method: 'GET',
        url: '/content-entries?contentType=erc:article-type',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { data: ContentEntryData[] };
      expect(body.data.length).toBeGreaterThanOrEqual(2);
      expect(body.data.every((e) => e.contentTypeId === contentTypeId)).toBe(true);
    });

    it('filters by site', async () => {
      const res = await asAdmin({
        method: 'GET',
        url: '/content-entries?site=erc:marketing-site',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { data: ContentEntryData[] };
      expect(body.data).toHaveLength(1);
      expect(body.data[0]!.siteId).toBe(siteId);
    });

    it('combines contentType and site filters', async () => {
      const res = await asAdmin({
        method: 'GET',
        url: `/content-entries?contentType=${contentTypeId}&site=${siteId}`,
      });
      expect(res.statusCode).toBe(200);
      expect((res.json() as { data: ContentEntryData[] }).data).toHaveLength(1);
    });

    it('returns 404 for an unknown filter ref', async () => {
      const res = await asAdmin({ method: 'GET', url: '/content-entries?contentType=erc:nope' });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('content type deletion protection', () => {
    it('returns 409 when the content type still has entries', async () => {
      const res = await asAdmin({ method: 'DELETE', url: `/content-types/${contentTypeId}` });
      expect(res.statusCode).toBe(409);
      expect(res.headers['content-type']).toContain('application/problem+json');
    });

    it('deletes the content type once its entries are gone', async () => {
      for (const id of entryIds) {
        const del = await asAdmin({ method: 'DELETE', url: `/content-entries/${id}` });
        expect(del.statusCode).toBe(204);
      }
      const res = await asAdmin({ method: 'DELETE', url: `/content-types/${contentTypeId}` });
      expect(res.statusCode).toBe(204);
    });
  });

  describe('permissions', () => {
    it('denies content endpoints to a role with no content grants', async () => {
      const cases = [
        { method: 'GET' as const, url: '/content-types' },
        {
          method: 'POST' as const,
          url: '/content-types',
          payload: { name: 'X', fields: [] },
        },
        { method: 'GET' as const, url: '/content-entries' },
        {
          method: 'POST' as const,
          url: '/content-entries',
          payload: { contentType: 'erc:whatever', title: 'X', values: {} },
        },
        { method: 'POST' as const, url: `/content-entries/${entryIds[0]}/publish` },
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
