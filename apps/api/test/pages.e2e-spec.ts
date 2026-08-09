import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './utils/test-app';
import { startTestDb, type TestDb } from './utils/test-db';

interface Tokens {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

interface PageBody {
  id: string;
  externalReferenceCode: string;
  tenantId: string;
  status: string;
  siteId: string;
  title: string;
  path: string;
  tree: Record<string, unknown>;
  masterPageTemplateId: string | null;
  customFields: Record<string, unknown>;
}

interface Problem {
  status: number;
  detail?: string;
  code?: string;
}

const HERO_PROPS_SCHEMA = {
  type: 'object',
  properties: { title: { type: 'string' }, subtitle: { type: 'string' } },
  required: ['title'],
};

const TEXT_PROPS_SCHEMA = {
  type: 'object',
  properties: { body: { type: 'string' } },
};

describe('pages (e2e)', () => {
  let testDb: TestDb;
  let app: NestFastifyApplication;
  let adminToken: string;
  let editorToken: string;
  let noPageToken: string;
  let siteId: string;
  let homePageId: string;

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

  async function createUserWithRole(
    email: string,
    roleName: string,
    permissions: { resourceType: string; action: string }[],
  ): Promise<string> {
    const role = await app.inject({
      method: 'POST',
      url: '/roles',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: roleName, permissions },
    });
    expect(role.statusCode).toBe(201);
    const roleId = (role.json() as { data: { id: string } }).data.id;

    const user = await app.inject({
      method: 'POST',
      url: '/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { email, displayName: roleName, password: 'temp-pass-123', roleIds: [roleId] },
    });
    expect(user.statusCode).toBe(201);
    return loginFresh(email, 'temp-pass-123', 'final-pass-123');
  }

  async function createBlock(payload: Record<string, unknown>): Promise<void> {
    const res = await app.inject({
      method: 'POST',
      url: '/blocks',
      headers: { authorization: `Bearer ${adminToken}` },
      payload,
    });
    expect(res.statusCode).toBe(201);
  }

  beforeAll(async () => {
    testDb = await startTestDb();
    app = await createTestApp(testDb.connectionUri);
    adminToken = await loginFresh('admin@neriva.com', 'admin', 'admin-password-1');
    editorToken = await createUserWithRole('page-editor@neriva.com', 'Page Editor', [
      { resourceType: 'page', action: 'create' },
      { resourceType: 'page', action: 'read' },
      { resourceType: 'page', action: 'update' },
      { resourceType: 'page', action: 'delete' },
      { resourceType: 'page', action: 'publish' },
    ]);
    noPageToken = await createUserWithRole('no-pages@neriva.com', 'User Reader', [
      { resourceType: 'user', action: 'read' },
    ]);

    const site = await app.inject({
      method: 'POST',
      url: '/sites',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Main Site', slug: 'main', externalReferenceCode: 'main-site' },
    });
    expect(site.statusCode).toBe(201);
    siteId = (site.json() as { data: { id: string } }).data.id;

    await createBlock({
      name: 'Hero Banner',
      externalReferenceCode: 'hero-banner',
      propsSchema: HERO_PROPS_SCHEMA,
      slots: [{ name: 'main' }],
    });
    await createBlock({
      name: 'Text',
      externalReferenceCode: 'text',
      propsSchema: TEXT_PROPS_SCHEMA,
    });
    // Stays DRAFT for the publish-blocking test.
    await createBlock({
      name: 'Draft Teaser',
      externalReferenceCode: 'draft-teaser',
      propsSchema: { type: 'object' },
    });

    for (const erc of ['hero-banner', 'text']) {
      const publish = await app.inject({
        method: 'POST',
        url: `/blocks/erc:${erc}/publish`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(publish.statusCode).toBe(200);
    }
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  it('creates a page with a valid tree (201, envelope, DRAFT default)', async () => {
    const tree = {
      blocks: [
        {
          block: 'hero-banner',
          props: { title: 'Welcome' },
          slots: { main: [{ block: 'text', props: { body: 'Hello' } }] },
        },
      ],
    };
    const res = await app.inject({
      method: 'POST',
      url: `/sites/${siteId}/pages`,
      headers: { authorization: `Bearer ${editorToken}` },
      payload: { title: 'Home', path: '/home', externalReferenceCode: 'home-page', tree },
    });
    expect(res.statusCode).toBe(201);
    const body = (res.json() as { data: PageBody }).data;
    homePageId = body.id;
    expect(body.externalReferenceCode).toBe('home-page');
    expect(body.tenantId).toBeTruthy();
    expect(body.siteId).toBe(siteId);
    expect(body.status).toBe('DRAFT');
    expect(body.path).toBe('/home');
    expect(body.tree).toEqual(tree);
    expect(body.customFields).toEqual({});
  });

  it('defaults the tree to { blocks: [] } and accepts erc site refs', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/sites/erc:main-site/pages',
      headers: { authorization: `Bearer ${editorToken}` },
      payload: { title: 'About', path: '/about' },
    });
    expect(res.statusCode).toBe(201);
    expect((res.json() as { data: PageBody }).data.tree).toEqual({ blocks: [] });
  });

  it('returns 404 when the site does not exist', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/sites/erc:missing-site/pages',
      headers: { authorization: `Bearer ${editorToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('lists the pages of a site with the list envelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/sites/${siteId}/pages?limit=1`,
      headers: { authorization: `Bearer ${editorToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: PageBody[]; meta: { cursor: string | null; limit: number } };
    expect(body.data).toHaveLength(1);
    expect(body.meta.limit).toBe(1);
    expect(body.meta.cursor).toBeTruthy();
  });

  it('gets a page by UUID and by erc reference', async () => {
    const byId = await app.inject({
      method: 'GET',
      url: `/pages/${homePageId}`,
      headers: { authorization: `Bearer ${editorToken}` },
    });
    expect(byId.statusCode).toBe(200);

    const byErc = await app.inject({
      method: 'GET',
      url: '/pages/erc:home-page',
      headers: { authorization: `Bearer ${editorToken}` },
    });
    expect(byErc.statusCode).toBe(200);
    expect((byErc.json() as { data: PageBody }).data.id).toBe(homePageId);
  });

  it('rejects a tree referencing an unknown block with 400 and a pointer', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/sites/${siteId}/pages`,
      headers: { authorization: `Bearer ${editorToken}` },
      payload: {
        title: 'Broken',
        path: '/broken',
        tree: { blocks: [{ block: 'no-such-block' }] },
      },
    });
    expect(res.statusCode).toBe(400);
    const problem = res.json() as Problem;
    expect(problem.detail).toContain('blocks[0]');
    expect(problem.detail).toContain('no-such-block');
  });

  it('rejects props that violate the block propsSchema with 400 and a pointer', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/sites/${siteId}/pages`,
      headers: { authorization: `Bearer ${editorToken}` },
      payload: {
        title: 'Bad Props',
        path: '/bad-props',
        tree: {
          blocks: [
            {
              block: 'hero-banner',
              props: { title: 'ok' },
              slots: { main: [{ block: 'text', props: { body: 123 } }] },
            },
          ],
        },
      },
    });
    expect(res.statusCode).toBe(400);
    const problem = res.json() as Problem;
    expect(problem.detail).toContain('blocks[0].slots.main[0]');
  });

  it('rejects an undeclared slot name with 400 and a pointer', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/pages/${homePageId}`,
      headers: { authorization: `Bearer ${editorToken}` },
      payload: {
        tree: {
          blocks: [{ block: 'hero-banner', props: { title: 'x' }, slots: { sidebar: [] } }],
        },
      },
    });
    expect(res.statusCode).toBe(400);
    const problem = res.json() as Problem;
    expect(problem.detail).toContain('blocks[0]');
    expect(problem.detail).toContain('sidebar');
  });

  it('rejects an invalid path with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/sites/${siteId}/pages`,
      headers: { authorization: `Bearer ${editorToken}` },
      payload: { title: 'Bad Path', path: 'no-leading-slash' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 409 on a (site, path) collision', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/sites/${siteId}/pages`,
      headers: { authorization: `Bearer ${editorToken}` },
      payload: { title: 'Home Again', path: '/home' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('allows the same path on a different site', async () => {
    const other = await app.inject({
      method: 'POST',
      url: '/sites',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Other Site', slug: 'other' },
    });
    expect(other.statusCode).toBe(201);
    const otherId = (other.json() as { data: { id: string } }).data.id;

    const res = await app.inject({
      method: 'POST',
      url: `/sites/${otherId}/pages`,
      headers: { authorization: `Bearer ${editorToken}` },
      payload: { title: 'Other Home', path: '/home' },
    });
    expect(res.statusCode).toBe(201);
  });

  it('updates title, path and tree via PATCH', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/pages/${homePageId}`,
      headers: { authorization: `Bearer ${editorToken}` },
      payload: {
        title: 'Homepage',
        path: '/homepage',
        tree: { blocks: [{ block: 'hero-banner', props: { title: 'Updated' } }] },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = (res.json() as { data: PageBody }).data;
    expect(body.title).toBe('Homepage');
    expect(body.path).toBe('/homepage');
    expect(body.tree).toEqual({ blocks: [{ block: 'hero-banner', props: { title: 'Updated' } }] });
  });

  it('refuses to publish a page referencing a non-PUBLISHED block (400)', async () => {
    const page = await app.inject({
      method: 'POST',
      url: `/sites/${siteId}/pages`,
      headers: { authorization: `Bearer ${editorToken}` },
      payload: {
        title: 'Teaser',
        path: '/teaser',
        tree: { blocks: [{ block: 'draft-teaser' }] },
      },
    });
    expect(page.statusCode).toBe(201);
    const pageId = (page.json() as { data: PageBody }).data.id;

    const publish = await app.inject({
      method: 'POST',
      url: `/pages/${pageId}/publish`,
      headers: { authorization: `Bearer ${editorToken}` },
    });
    expect(publish.statusCode).toBe(400);
    const problem = publish.json() as Problem;
    expect(problem.detail).toContain('blocks[0]');
    expect(problem.detail).toContain('draft-teaser');
  });

  it('publishes a page whose blocks are all PUBLISHED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/pages/${homePageId}/publish`,
      headers: { authorization: `Bearer ${editorToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { data: PageBody }).data.status).toBe('PUBLISHED');
  });

  it('creates a page from a templateId, copying its tree once with no ongoing link', async () => {
    const template = await app.inject({
      method: 'POST',
      url: '/page-templates',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Starter',
        kind: 'STANDARD',
        externalReferenceCode: 'starter-template',
        tree: { blocks: [{ block: 'hero-banner', props: { title: 'From template' } }] },
      },
    });
    expect(template.statusCode).toBe(201);

    const page = await app.inject({
      method: 'POST',
      url: `/sites/${siteId}/pages`,
      headers: { authorization: `Bearer ${editorToken}` },
      payload: {
        title: 'From Template',
        path: '/from-template',
        templateId: 'erc:starter-template',
      },
    });
    expect(page.statusCode).toBe(201);
    const body = (page.json() as { data: PageBody }).data;
    expect(body.tree).toEqual({
      blocks: [{ block: 'hero-banner', props: { title: 'From template' } }],
    });

    // No ongoing link: changing the template afterwards does not affect the
    // page that was created from it.
    const patchTemplate = await app.inject({
      method: 'PATCH',
      url: '/page-templates/erc:starter-template',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { tree: { blocks: [] } },
    });
    expect(patchTemplate.statusCode).toBe(200);

    const reread = await app.inject({
      method: 'GET',
      url: `/pages/${body.id}`,
      headers: { authorization: `Bearer ${editorToken}` },
    });
    expect(reread.statusCode).toBe(200);
    expect((reread.json() as { data: PageBody }).data.tree).toEqual({
      blocks: [{ block: 'hero-banner', props: { title: 'From template' } }],
    });
  });

  it('rejects a templateId that is not a STANDARD template with 400', async () => {
    const master = await app.inject({
      method: 'POST',
      url: '/page-templates',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Not Standard', kind: 'MASTER', externalReferenceCode: 'not-standard' },
    });
    expect(master.statusCode).toBe(201);

    const res = await app.inject({
      method: 'POST',
      url: `/sites/${siteId}/pages`,
      headers: { authorization: `Bearer ${editorToken}` },
      payload: { title: 'Bad Template', path: '/bad-template', templateId: 'erc:not-standard' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('sets masterPageTemplateId on create, validated for kind and site', async () => {
    const master = await app.inject({
      method: 'POST',
      url: '/page-templates',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Page Master', kind: 'MASTER', externalReferenceCode: 'page-master' },
    });
    expect(master.statusCode).toBe(201);
    const masterId = (master.json() as { data: { id: string } }).data.id;

    const page = await app.inject({
      method: 'POST',
      url: `/sites/${siteId}/pages`,
      headers: { authorization: `Bearer ${editorToken}` },
      payload: { title: 'With Master', path: '/with-master', masterPageTemplateId: masterId },
    });
    expect(page.statusCode).toBe(201);
    const body = (page.json() as { data: PageBody }).data;
    expect(body.masterPageTemplateId).toBe(masterId);

    // PATCH can clear it with an explicit null.
    const cleared = await app.inject({
      method: 'PATCH',
      url: `/pages/${body.id}`,
      headers: { authorization: `Bearer ${editorToken}` },
      payload: { masterPageTemplateId: null },
    });
    expect(cleared.statusCode).toBe(200);
    expect((cleared.json() as { data: PageBody }).data.masterPageTemplateId).toBeNull();
  });

  it('rejects a masterPageTemplateId that is not a MASTER template with 400', async () => {
    const standard = await app.inject({
      method: 'POST',
      url: '/page-templates',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Not Master', kind: 'STANDARD', externalReferenceCode: 'not-master' },
    });
    expect(standard.statusCode).toBe(201);

    const res = await app.inject({
      method: 'POST',
      url: `/sites/${siteId}/pages`,
      headers: { authorization: `Bearer ${editorToken}` },
      payload: { title: 'Bad Master', path: '/bad-master', masterPageTemplateId: 'erc:not-master' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a masterPageTemplateId scoped to a different site with 400', async () => {
    const otherSite = await app.inject({
      method: 'POST',
      url: '/sites',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'Scoped Site', slug: 'scoped-site' },
    });
    expect(otherSite.statusCode).toBe(201);
    const otherSiteId = (otherSite.json() as { data: { id: string } }).data.id;

    const scopedMaster = await app.inject({
      method: 'POST',
      url: '/page-templates',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Scoped Master',
        kind: 'MASTER',
        externalReferenceCode: 'scoped-master',
        site: otherSiteId,
      },
    });
    expect(scopedMaster.statusCode).toBe(201);

    const res = await app.inject({
      method: 'POST',
      url: `/sites/${siteId}/pages`,
      headers: { authorization: `Bearer ${editorToken}` },
      payload: {
        title: 'Wrong Site Master',
        path: '/wrong-site-master',
        masterPageTemplateId: 'erc:scoped-master',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('denies every page endpoint to a role without page grants (403)', async () => {
    const denied = [
      { method: 'GET' as const, url: `/sites/${siteId}/pages` },
      { method: 'POST' as const, url: `/sites/${siteId}/pages` },
      { method: 'GET' as const, url: `/pages/${homePageId}` },
      { method: 'PATCH' as const, url: `/pages/${homePageId}` },
      { method: 'DELETE' as const, url: `/pages/${homePageId}` },
      { method: 'POST' as const, url: `/pages/${homePageId}/publish` },
    ];
    for (const attempt of denied) {
      const res = await app.inject({
        ...attempt,
        headers: { authorization: `Bearer ${noPageToken}` },
        ...(attempt.method === 'POST' || attempt.method === 'PATCH' ? { payload: {} } : {}),
      });
      expect(res.statusCode).toBe(403);
      expect((res.json() as Problem).code).toBe('PERMISSION_DENIED');
    }
  });

  it('deletes a page and returns 404 afterwards', async () => {
    const del = await app.inject({
      method: 'DELETE',
      url: '/pages/erc:home-page',
      headers: { authorization: `Bearer ${editorToken}` },
    });
    expect(del.statusCode).toBe(204);

    const gone = await app.inject({
      method: 'GET',
      url: '/pages/erc:home-page',
      headers: { authorization: `Bearer ${editorToken}` },
    });
    expect(gone.statusCode).toBe(404);
  });
});
