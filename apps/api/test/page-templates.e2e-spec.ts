import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './utils/test-app';
import { startTestDb, type TestDb } from './utils/test-db';

interface Tokens {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

interface PageTemplateBody {
  id: string;
  externalReferenceCode: string;
  tenantId: string;
  name: string;
  kind: 'MASTER' | 'STANDARD';
  siteId: string | null;
  tree: Record<string, unknown>;
  isDefault: boolean;
}

interface Problem {
  status: number;
  detail?: string;
  code?: string;
}

describe('page templates (e2e)', () => {
  let testDb: TestDb;
  let app: NestFastifyApplication;
  let adminToken: string;
  let noGrantToken: string;

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
    const erc = payload.externalReferenceCode as string;
    const publish = await app.inject({
      method: 'POST',
      url: `/blocks/erc:${erc}/publish`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(publish.statusCode).toBe(200);
  }

  async function createTemplate(payload: Record<string, unknown>): Promise<PageTemplateBody> {
    const res = await app.inject({
      method: 'POST',
      url: '/page-templates',
      headers: { authorization: `Bearer ${adminToken}` },
      payload,
    });
    expect(res.statusCode).toBe(201);
    return (res.json() as { data: PageTemplateBody }).data;
  }

  beforeAll(async () => {
    testDb = await startTestDb();
    app = await createTestApp(testDb.connectionUri);
    adminToken = await loginFresh('admin@neriva.com', 'admin', 'admin-password-1');
    noGrantToken = await createUserWithRole('template-bystander@neriva.com', 'Template Bystander', [
      { resourceType: 'user', action: 'read' },
    ]);

    await createBlock({
      name: 'Container',
      externalReferenceCode: 'container-test',
      propsSchema: { type: 'object' },
      slots: [{ name: 'content' }],
    });
    await createBlock({
      name: 'Text',
      externalReferenceCode: 'text-test',
      propsSchema: { type: 'object' },
    });
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  describe('CRUD and drop-zone validation', () => {
    it('creates a MASTER template defaulting to a single drop-zone tree', async () => {
      const template = await createTemplate({ name: 'Master A', kind: 'MASTER' });
      expect(template.kind).toBe('MASTER');
      expect(template.siteId).toBeNull();
      expect(template.tree).toEqual({ blocks: [{ block: '__page_content__' }] });
    });

    it('creates a STANDARD template defaulting to an empty tree', async () => {
      const template = await createTemplate({ name: 'Standard A', kind: 'STANDARD' });
      expect(template.kind).toBe('STANDARD');
      expect(template.tree).toEqual({ blocks: [] });
    });

    it('accepts a MASTER tree with the drop zone nested inside a slot', async () => {
      const template = await createTemplate({
        name: 'Master Nested',
        kind: 'MASTER',
        tree: {
          blocks: [
            {
              block: 'container-test',
              slots: { content: [{ block: 'text-test' }, { block: '__page_content__' }] },
            },
          ],
        },
      });
      expect(template.tree).toEqual({
        blocks: [
          {
            block: 'container-test',
            slots: { content: [{ block: 'text-test' }, { block: '__page_content__' }] },
          },
        ],
      });
    });

    it('rejects a MASTER tree with zero drop-zone occurrences', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/page-templates',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Master Zero',
          kind: 'MASTER',
          tree: { blocks: [{ block: 'text-test' }] },
        },
      });
      expect(res.statusCode).toBe(400);
      expect((res.json() as Problem).detail).toContain(
        'a master page must contain exactly one page-content drop zone',
      );
    });

    it('rejects a MASTER tree with two or more drop-zone occurrences', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/page-templates',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Master Two',
          kind: 'MASTER',
          tree: { blocks: [{ block: '__page_content__' }, { block: '__page_content__' }] },
        },
      });
      expect(res.statusCode).toBe(400);
      expect((res.json() as Problem).detail).toContain(
        'a master page must contain exactly one page-content drop zone',
      );
    });

    it('rejects a STANDARD tree that contains the drop zone', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/page-templates',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Standard With Zone',
          kind: 'STANDARD',
          tree: { blocks: [{ block: '__page_content__' }] },
        },
      });
      expect(res.statusCode).toBe(400);
      expect((res.json() as Problem).detail).toContain('__page_content__');
    });

    it('rejects a drop zone carrying props or slots', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/page-templates',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Master Bad Zone',
          kind: 'MASTER',
          tree: { blocks: [{ block: '__page_content__', props: { x: 1 } }] },
        },
      });
      expect(res.statusCode).toBe(400);
      expect((res.json() as Problem).detail).toContain('drop zone accepts no props');
    });

    it('gets a template by UUID and by erc reference', async () => {
      const created = await createTemplate({
        name: 'Get Me',
        kind: 'STANDARD',
        externalReferenceCode: 'get-me',
      });
      const byId = await app.inject({
        method: 'GET',
        url: `/page-templates/${created.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(byId.statusCode).toBe(200);

      const byErc = await app.inject({
        method: 'GET',
        url: '/page-templates/erc:get-me',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(byErc.statusCode).toBe(200);
      expect((byErc.json() as { data: PageTemplateBody }).data.id).toBe(created.id);
    });

    it('lists templates filtered by kind', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/page-templates?kind=STANDARD',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { data: PageTemplateBody[] };
      expect(body.data.length).toBeGreaterThan(0);
      for (const item of body.data) {
        expect(item.kind).toBe('STANDARD');
      }
    });

    it('updates name and tree via PATCH, re-validated against the existing kind', async () => {
      const created = await createTemplate({
        name: 'Patch Me',
        kind: 'STANDARD',
        externalReferenceCode: 'patch-me',
      });
      const ok = await app.inject({
        method: 'PATCH',
        url: `/page-templates/${created.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Patched', tree: { blocks: [{ block: 'text-test' }] } },
      });
      expect(ok.statusCode).toBe(200);
      const body = (ok.json() as { data: PageTemplateBody }).data;
      expect(body.name).toBe('Patched');
      expect(body.tree).toEqual({ blocks: [{ block: 'text-test' }] });

      // Still STANDARD: a drop zone is now rejected exactly as on create.
      const bad = await app.inject({
        method: 'PATCH',
        url: `/page-templates/${created.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { tree: { blocks: [{ block: '__page_content__' }] } },
      });
      expect(bad.statusCode).toBe(400);
    });

    it('returns 409 on a name or ERC collision', async () => {
      await createTemplate({
        name: 'Unique Name',
        kind: 'STANDARD',
        externalReferenceCode: 'unique-erc',
      });
      const res = await app.inject({
        method: 'POST',
        url: '/page-templates',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Unique Name', kind: 'STANDARD' },
      });
      expect(res.statusCode).toBe(409);
    });

    it('deletes a template with 204 then 404', async () => {
      const created = await createTemplate({ name: 'Delete Me', kind: 'STANDARD' });
      const del = await app.inject({
        method: 'DELETE',
        url: `/page-templates/${created.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(del.statusCode).toBe(204);

      const gone = await app.inject({
        method: 'GET',
        url: `/page-templates/${created.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(gone.statusCode).toBe(404);
    });

    it('denies every page-template endpoint to a role without page-template grants (403)', async () => {
      const template = await createTemplate({ name: 'Guarded', kind: 'STANDARD' });
      const denied = [
        { method: 'GET' as const, url: '/page-templates' },
        { method: 'POST' as const, url: '/page-templates' },
        { method: 'GET' as const, url: `/page-templates/${template.id}` },
        { method: 'PATCH' as const, url: `/page-templates/${template.id}` },
        { method: 'POST' as const, url: `/page-templates/${template.id}/set-default` },
        { method: 'DELETE' as const, url: `/page-templates/${template.id}` },
      ];
      for (const attempt of denied) {
        const res = await app.inject({
          ...attempt,
          headers: { authorization: `Bearer ${noGrantToken}` },
          ...(attempt.method === 'POST' || attempt.method === 'PATCH' ? { payload: {} } : {}),
        });
        expect(res.statusCode).toBe(403);
        expect((res.json() as Problem).code).toBe('PERMISSION_DENIED');
      }
    });
  });

  describe('marking a MASTER template as default', () => {
    it('creates a template with isDefault false, then marks it default via the action endpoint', async () => {
      const template = await createTemplate({ name: 'Default Candidate', kind: 'MASTER' });
      expect(template.isDefault).toBe(false);

      const res = await app.inject({
        method: 'POST',
        url: `/page-templates/${template.id}/set-default`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      expect((res.json() as { data: PageTemplateBody }).data.isDefault).toBe(true);

      const reread = await app.inject({
        method: 'GET',
        url: `/page-templates/${template.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect((reread.json() as { data: PageTemplateBody }).data.isDefault).toBe(true);
    });

    it('unsets the previously marked default when a new one is marked (at most one default)', async () => {
      const first = await createTemplate({ name: 'First Default', kind: 'MASTER' });
      const second = await createTemplate({ name: 'Second Default', kind: 'MASTER' });

      const markFirst = await app.inject({
        method: 'POST',
        url: `/page-templates/${first.id}/set-default`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(markFirst.statusCode).toBe(200);

      const markSecond = await app.inject({
        method: 'POST',
        url: `/page-templates/${second.id}/set-default`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(markSecond.statusCode).toBe(200);

      const firstAfter = await app.inject({
        method: 'GET',
        url: `/page-templates/${first.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect((firstAfter.json() as { data: PageTemplateBody }).data.isDefault).toBe(false);

      const secondAfter = await app.inject({
        method: 'GET',
        url: `/page-templates/${second.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect((secondAfter.json() as { data: PageTemplateBody }).data.isDefault).toBe(true);
    });

    it('rejects marking a STANDARD template as default (400)', async () => {
      const standard = await createTemplate({ name: 'Not A Master', kind: 'STANDARD' });
      const res = await app.inject({
        method: 'POST',
        url: `/page-templates/${standard.id}/set-default`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(400);
      expect((res.json() as Problem).detail).toContain('MASTER');
    });
  });

  describe('delete guard when referenced by a page', () => {
    it('409s deleting a MASTER referenced by a page, then succeeds once detached', async () => {
      const site = await app.inject({
        method: 'POST',
        url: '/sites',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Guard Site', slug: 'guard-site' },
      });
      expect(site.statusCode).toBe(201);
      const siteId = (site.json() as { data: { id: string } }).data.id;

      const master = await createTemplate({ name: 'Guarded Master', kind: 'MASTER' });
      const page = await app.inject({
        method: 'POST',
        url: `/sites/${siteId}/pages`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { title: 'Guarded Page', path: '/guarded', masterPageTemplateId: master.id },
      });
      expect(page.statusCode).toBe(201);
      const pageId = (page.json() as { data: { id: string } }).data.id;

      const blocked = await app.inject({
        method: 'DELETE',
        url: `/page-templates/${master.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(blocked.statusCode).toBe(409);

      const detach = await app.inject({
        method: 'PATCH',
        url: `/pages/${pageId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { masterPageTemplateId: null },
      });
      expect(detach.statusCode).toBe(200);

      const now = await app.inject({
        method: 'DELETE',
        url: `/page-templates/${master.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(now.statusCode).toBe(204);
    });
  });
});
