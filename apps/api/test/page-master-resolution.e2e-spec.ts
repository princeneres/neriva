import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MASTER_DEFAULT_ERC } from '../src/db/native-master-page-seed.service';
import { createTestApp } from './utils/test-app';
import { startTestDb, type TestDb } from './utils/test-db';

interface Tokens {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

// Exercises the full master resolution order (spec 14): page's own
// masterPageTemplateId -> the tenant's isDefault MASTER template -> the
// oldest MASTER template -> no master. This gets its own app/database
// (unlike page-templates.e2e-spec.ts) so the seeded default master is the
// only MASTER template present at the start of the run; sharing a database
// with other template CRUD tests would leave extra MASTER rows around and
// make the "oldest" and "none" fallbacks unobservable.
describe('page master resolution order (e2e)', () => {
  let testDb: TestDb;
  let app: NestFastifyApplication;
  let adminToken: string;
  let siteId: string;

  async function login(email: string, password: string): Promise<Tokens> {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password },
    });
    expect(res.statusCode).toBe(200);
    return (res.json() as { data: Tokens }).data;
  }

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

  async function createBlock(erc: string): Promise<void> {
    const res = await app.inject({
      method: 'POST',
      url: '/blocks',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: erc, externalReferenceCode: erc, propsSchema: { type: 'object' } },
    });
    expect(res.statusCode).toBe(201);
    const publish = await app.inject({
      method: 'POST',
      url: `/blocks/erc:${erc}/publish`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(publish.statusCode).toBe(200);
  }

  async function createMasterTemplate(erc: string, markerBlock: string): Promise<{ id: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/page-templates',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: erc,
        kind: 'MASTER',
        externalReferenceCode: erc,
        tree: { blocks: [{ block: markerBlock }, { block: '__page_content__' }] },
      },
    });
    expect(res.statusCode).toBe(201);
    return (res.json() as { data: { id: string } }).data;
  }

  async function setDefaultMaster(id: string): Promise<void> {
    const res = await app.inject({
      method: 'POST',
      url: `/page-templates/${id}/set-default`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
  }

  async function createAndPublishPage(path: string, extra: Record<string, unknown>): Promise<void> {
    const create = await app.inject({
      method: 'POST',
      url: `/sites/${siteId}/pages`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { title: path, path, tree: { blocks: [{ block: 'page-own' }] }, ...extra },
    });
    expect(create.statusCode).toBe(201);
    const id = (create.json() as { data: { id: string } }).data.id;
    const publish = await app.inject({
      method: 'POST',
      url: `/pages/${id}/publish`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(publish.statusCode).toBe(200);
  }

  async function deliveredTree(path: string): Promise<unknown> {
    const res = await app.inject({
      method: 'GET',
      url: '/public/sites/resolution-site/page',
      query: { path },
    });
    expect(res.statusCode).toBe(200);
    return (res.json() as { data: { page: { tree: unknown } } }).data.page.tree;
  }

  beforeAll(async () => {
    testDb = await startTestDb();
    app = await createTestApp(testDb.connectionUri);
    adminToken = await loginFresh('admin@neriva.com', 'admin', 'admin-password-1');

    const site = await app.inject({
      method: 'POST',
      url: '/sites',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Resolution Site', slug: 'resolution-site' },
    });
    expect(site.statusCode).toBe(201);
    siteId = (site.json() as { data: { id: string } }).data.id;

    for (const erc of ['marker-a', 'marker-b', 'marker-c', 'page-own']) {
      await createBlock(erc);
    }
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  it('falls back to no master when the seeded default is removed and no MASTER template exists', async () => {
    // Fresh app instance: the only MASTER template that exists at boot is
    // the seeded default (isDefault = true), and nothing references it yet.
    const dropMaster = await app.inject({
      method: 'DELETE',
      url: `/page-templates/erc:${MASTER_DEFAULT_ERC}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(dropMaster.statusCode).toBe(204);

    await createAndPublishPage('/none', {});
    expect(await deliveredTree('/none')).toEqual({ blocks: [{ block: 'page-own' }] });
  });

  it('falls back to the oldest MASTER template when no explicit master and no default marked', async () => {
    await createMasterTemplate('res-master-a', 'marker-a');

    await createAndPublishPage('/oldest', {});
    expect(await deliveredTree('/oldest')).toEqual({
      blocks: [{ block: 'marker-a' }, { block: 'page-own' }],
    });
  });

  it('prefers the tenant isDefault MASTER template over the oldest MASTER', async () => {
    // Older than res-master-a would win by createdAt if isDefault did not
    // take precedence; created after it here to make that ordering explicit.
    const templateB = await createMasterTemplate('res-master-b', 'marker-b');
    await setDefaultMaster(templateB.id);

    await createAndPublishPage('/default', {});
    expect(await deliveredTree('/default')).toEqual({
      blocks: [{ block: 'marker-b' }, { block: 'page-own' }],
    });
  });

  it('unsets the previous default when a new one is marked', async () => {
    await createBlock('marker-d');
    const templateD = await createMasterTemplate('res-master-d', 'marker-d');
    await setDefaultMaster(templateD.id);

    const list = await app.inject({
      method: 'GET',
      url: '/page-templates?kind=MASTER',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(list.statusCode).toBe(200);
    const masters = (
      list.json() as { data: { externalReferenceCode: string; isDefault: boolean }[] }
    ).data;
    const defaults = masters.filter((m) => m.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.externalReferenceCode).toBe('res-master-d');

    await createAndPublishPage('/new-default', {});
    expect(await deliveredTree('/new-default')).toEqual({
      blocks: [{ block: 'marker-d' }, { block: 'page-own' }],
    });
  });

  it("prefers the page's own explicit masterPageTemplateId over the default", async () => {
    const templateC = await createMasterTemplate('res-master-c', 'marker-c');

    await createAndPublishPage('/explicit', { masterPageTemplateId: templateC.id });
    // The default still points at res-master-d, but this page names C explicitly.
    expect(await deliveredTree('/explicit')).toEqual({
      blocks: [{ block: 'marker-c' }, { block: 'page-own' }],
    });
  });
});
