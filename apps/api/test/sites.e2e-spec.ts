import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sites, tenants } from '../src/db/schema';
import { TenantScopedRepository } from '../src/db/tenant-scoped.repository';
import { createTestApp } from './utils/test-app';
import { startTestDb, type TestDb } from './utils/test-db';

interface Tokens {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

interface SiteData {
  id: string;
  externalReferenceCode: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  customFields: Record<string, unknown>;
}

describe('sites (e2e)', () => {
  let testDb: TestDb;
  let app: NestFastifyApplication;
  let adminToken: string;
  let editorToken: string;
  let site: SiteData;

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

  it('creates a site with the standard envelope (happy path)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/sites',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Main Site', slug: 'main-site', description: 'Primary site' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { data: SiteData };
    site = body.data;
    expect(site.name).toBe('Main Site');
    expect(site.slug).toBe('main-site');
    expect(site.description).toBe('Primary site');
    expect(site.id).toBeTruthy();
    expect(site.externalReferenceCode).toBeTruthy();
    expect(site.tenantId).toBeTruthy();
    expect(site.customFields).toEqual({});
  });

  it('normalizes slug to lowercase on create', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/sites',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Docs', slug: 'DOCS-Site', externalReferenceCode: 'docs-site-erc' },
    });
    expect(res.statusCode).toBe(201);
    expect((res.json() as { data: SiteData }).data.slug).toBe('docs-site');
  });

  it('rejects an invalid slug with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/sites',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Bad', slug: 'not a slug!' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 409 on duplicate slug', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/sites',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Duplicate', slug: 'main-site' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('returns 409 on duplicate externalReferenceCode', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/sites',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Dup ERC', slug: 'dup-erc', externalReferenceCode: 'docs-site-erc' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('lists sites with the list envelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/sites',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: SiteData[]; meta: { cursor: string | null; limit: number } };
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    expect(body.meta.limit).toBe(20);
  });

  it('gets a site by UUID and by erc:<code>', async () => {
    const byId = await app.inject({
      method: 'GET',
      url: `/sites/${site.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(byId.statusCode).toBe(200);
    expect((byId.json() as { data: SiteData }).data.id).toBe(site.id);

    const byErc = await app.inject({
      method: 'GET',
      url: `/sites/erc:${site.externalReferenceCode}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(byErc.statusCode).toBe(200);
    expect((byErc.json() as { data: SiteData }).data.id).toBe(site.id);
  });

  it('returns 404 for an unknown site', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/sites/erc:does-not-exist',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('updates name, slug and description', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/sites/${site.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Main Site v2', slug: 'Main-Site-V2', description: null },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: SiteData };
    expect(body.data.name).toBe('Main Site v2');
    expect(body.data.slug).toBe('main-site-v2');
    expect(body.data.description).toBeNull();
  });

  it('returns 409 when updating to an existing slug', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/sites/${site.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { slug: 'docs-site' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('denies access for a role without site grants', async () => {
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

    const user = await app.inject({
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
    expect(user.statusCode).toBe(201);
    editorToken = await loginFresh('editor@neriva.com', 'editor-temp-pass', 'editor-final-pass');

    const list = await app.inject({
      method: 'GET',
      url: '/sites',
      headers: { authorization: `Bearer ${editorToken}` },
    });
    expect(list.statusCode).toBe(403);
    expect(list.headers['content-type']).toContain('application/problem+json');
    expect(list.json()).toMatchObject({
      status: 403,
      code: 'PERMISSION_DENIED',
      detail: 'Missing permission site:read',
    });

    const create = await app.inject({
      method: 'POST',
      url: '/sites',
      headers: { authorization: `Bearer ${editorToken}` },
      payload: { name: 'Nope', slug: 'nope' },
    });
    expect(create.statusCode).toBe(403);
  });

  it('scopes every repository query to the tenant', async () => {
    const [otherTenant] = await testDb.db
      .insert(tenants)
      .values({ name: 'Other Tenant', externalReferenceCode: 'other-tenant' })
      .returning();
    expect(otherTenant).toBeDefined();

    const otherRepo = new TenantScopedRepository(testDb.db, sites, otherTenant!.id);
    const foreignSite = await otherRepo.create({
      name: 'Foreign Site',
      slug: 'foreign-site',
    });

    // The default-tenant repository must not see the other tenant's site.
    const defaultRepo = new TenantScopedRepository(testDb.db, sites, site.tenantId);
    expect(await defaultRepo.findById(foreignSite.id)).toBeNull();
    expect(await defaultRepo.findByErc(foreignSite.externalReferenceCode)).toBeNull();
    const page = await defaultRepo.list({ limit: 100 });
    expect(page.items.every((s) => s.tenantId === site.tenantId)).toBe(true);

    // And the API (scoped by the JWT tenant) returns 404 for it.
    const res = await app.inject({
      method: 'GET',
      url: `/sites/${foreignSite.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('deletes a site with 204 and then 404s', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/sites/${site.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(204);

    const gone = await app.inject({
      method: 'GET',
      url: `/sites/${site.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(gone.statusCode).toBe(404);
  });
});
