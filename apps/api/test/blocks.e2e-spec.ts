import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './utils/test-app';
import { startTestDb, type TestDb } from './utils/test-db';

interface Tokens {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

interface BlockBody {
  id: string;
  externalReferenceCode: string;
  tenantId: string;
  status: string;
  name: string;
  category: string | null;
  description: string | null;
  propsSchema: Record<string, unknown>;
  slots: { name: string; allowedBlocks?: string[] }[];
  html: string | null;
  css: string | null;
}

const HERO_PROPS_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    subtitle: { type: 'string' },
  },
  required: ['title'],
};

describe('blocks (e2e)', () => {
  let testDb: TestDb;
  let app: NestFastifyApplication;
  let adminToken: string;
  let editorToken: string;
  let noBlockToken: string;
  let heroId: string;

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

  beforeAll(async () => {
    testDb = await startTestDb();
    app = await createTestApp(testDb.connectionUri);
    adminToken = await loginFresh('admin@neriva.com', 'admin', 'admin-password-1');
    editorToken = await createUserWithRole('block-editor@neriva.com', 'Block Editor', [
      { resourceType: 'block', action: 'create' },
      { resourceType: 'block', action: 'read' },
      { resourceType: 'block', action: 'update' },
      { resourceType: 'block', action: 'delete' },
      { resourceType: 'block', action: 'publish' },
    ]);
    noBlockToken = await createUserWithRole('no-blocks@neriva.com', 'User Reader', [
      { resourceType: 'user', action: 'read' },
    ]);
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  it('creates a block with propsSchema and slots (201, envelope, DRAFT default)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/blocks',
      headers: { authorization: `Bearer ${editorToken}` },
      payload: {
        name: 'Hero Banner',
        category: 'content',
        description: 'Large banner with title and subtitle',
        externalReferenceCode: 'hero-banner',
        propsSchema: HERO_PROPS_SCHEMA,
        slots: [{ name: 'main' }, { name: 'side-bar', allowedBlocks: ['hero-banner'] }],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = (res.json() as { data: BlockBody }).data;
    heroId = body.id;
    expect(body.externalReferenceCode).toBe('hero-banner');
    expect(body.tenantId).toBeTruthy();
    expect(body.status).toBe('DRAFT');
    expect(body.propsSchema).toEqual(HERO_PROPS_SCHEMA);
    expect(body.slots).toEqual([
      { name: 'main' },
      { name: 'side-bar', allowedBlocks: ['hero-banner'] },
    ]);
  });

  it('gets a block by UUID and by erc reference', async () => {
    const byId = await app.inject({
      method: 'GET',
      url: `/blocks/${heroId}`,
      headers: { authorization: `Bearer ${editorToken}` },
    });
    expect(byId.statusCode).toBe(200);

    const byErc = await app.inject({
      method: 'GET',
      url: '/blocks/erc:hero-banner',
      headers: { authorization: `Bearer ${editorToken}` },
    });
    expect(byErc.statusCode).toBe(200);
    expect((byErc.json() as { data: BlockBody }).data.id).toBe(heroId);
  });

  it('lists blocks with the standard envelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/blocks',
      headers: { authorization: `Bearer ${editorToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data: BlockBody[];
      meta: { cursor: string | null; limit: number };
    };
    expect(body.meta.limit).toBe(20);

    // The seeded catalog alone fills the default page, so finding this test's
    // own block needs an explicit limit rather than luck about the count.
    const all = await app.inject({
      method: 'GET',
      url: '/blocks?limit=100',
      headers: { authorization: `Bearer ${editorToken}` },
    });
    expect(all.statusCode).toBe(200);
    const allBody = all.json() as { data: BlockBody[] };
    expect(allBody.data.some((b) => b.id === heroId)).toBe(true);
  });

  it('updates a block (PATCH)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/blocks/${heroId}`,
      headers: { authorization: `Bearer ${editorToken}` },
      payload: { description: 'Updated description', slots: [{ name: 'main' }] },
    });
    expect(res.statusCode).toBe(200);
    const body = (res.json() as { data: BlockBody }).data;
    expect(body.description).toBe('Updated description');
    expect(body.slots).toEqual([{ name: 'main' }]);
    expect(body.name).toBe('Hero Banner');
  });

  it('rejects an invalid propsSchema with 400 problem+json and the reason in detail', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/blocks',
      headers: { authorization: `Bearer ${editorToken}` },
      payload: { name: 'Broken', propsSchema: { type: 'not-a-type' } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    const body = res.json() as { status: number; detail: string };
    expect(body.status).toBe(400);
    expect(body.detail).toContain('propsSchema is not a valid JSON Schema (draft 2020-12)');
  });

  it('rejects duplicate slot names with 400 and the reason in detail', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/blocks',
      headers: { authorization: `Bearer ${editorToken}` },
      payload: {
        name: 'Two Mains',
        propsSchema: { type: 'object' },
        slots: [{ name: 'main' }, { name: 'main' }],
      },
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { detail: string }).detail).toBe('Duplicate slot name "main"');
  });

  it('rejects invalid slot names with 400', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/blocks/${heroId}`,
      headers: { authorization: `Bearer ${editorToken}` },
      payload: { slots: [{ name: 'Not Valid' }] },
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { detail: string }).detail).toContain('Slot name "Not Valid" is invalid');
  });

  it('publishes a block and filters the list by status', async () => {
    const publish = await app.inject({
      method: 'POST',
      url: `/blocks/${heroId}/publish`,
      headers: { authorization: `Bearer ${editorToken}` },
    });
    expect(publish.statusCode).toBe(200);
    expect((publish.json() as { data: BlockBody }).data.status).toBe('PUBLISHED');

    const draft = await app.inject({
      method: 'POST',
      url: '/blocks',
      headers: { authorization: `Bearer ${editorToken}` },
      payload: { name: 'Still Draft', propsSchema: { type: 'object' } },
    });
    expect(draft.statusCode).toBe(201);

    const published = await app.inject({
      method: 'GET',
      url: '/blocks?status=PUBLISHED',
      headers: { authorization: `Bearer ${editorToken}` },
    });
    expect(published.statusCode).toBe(200);
    const publishedBody = published.json() as { data: BlockBody[] };
    expect(publishedBody.data.length).toBeGreaterThan(0);
    expect(publishedBody.data.every((b) => b.status === 'PUBLISHED')).toBe(true);

    const drafts = await app.inject({
      method: 'GET',
      url: '/blocks?status=DRAFT',
      headers: { authorization: `Bearer ${editorToken}` },
    });
    expect(drafts.statusCode).toBe(200);
    const draftsBody = drafts.json() as { data: BlockBody[] };
    expect(draftsBody.data.every((b) => b.status === 'DRAFT')).toBe(true);
    expect(draftsBody.data.some((b) => b.name === 'Still Draft')).toBe(true);
  });

  it('rejects an invalid status filter with 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/blocks?status=NONSENSE',
      headers: { authorization: `Bearer ${editorToken}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 409 on duplicate externalReferenceCode', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/blocks',
      headers: { authorization: `Bearer ${editorToken}` },
      payload: {
        name: 'Hero Again',
        externalReferenceCode: 'hero-banner',
        propsSchema: { type: 'object' },
      },
    });
    expect(res.statusCode).toBe(409);
  });

  it('denies every block endpoint for a role with no block grants (403 problem+json)', async () => {
    const list = await app.inject({
      method: 'GET',
      url: '/blocks',
      headers: { authorization: `Bearer ${noBlockToken}` },
    });
    expect(list.statusCode).toBe(403);
    expect(list.headers['content-type']).toContain('application/problem+json');
    expect(list.json()).toMatchObject({
      status: 403,
      code: 'PERMISSION_DENIED',
      detail: 'Missing permission block:read',
    });

    const create = await app.inject({
      method: 'POST',
      url: '/blocks',
      headers: { authorization: `Bearer ${noBlockToken}` },
      payload: { name: 'Nope', propsSchema: { type: 'object' } },
    });
    expect(create.statusCode).toBe(403);

    const publish = await app.inject({
      method: 'POST',
      url: `/blocks/${heroId}/publish`,
      headers: { authorization: `Bearer ${noBlockToken}` },
    });
    expect(publish.statusCode).toBe(403);
    expect(publish.json()).toMatchObject({ detail: 'Missing permission block:publish' });
  });

  it('creates a block without a template (html and css null)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/blocks',
      headers: { authorization: `Bearer ${editorToken}` },
      payload: { name: 'Registry Block', propsSchema: { type: 'object' } },
    });
    expect(res.statusCode).toBe(201);
    const body = (res.json() as { data: BlockBody }).data;
    expect(body.html).toBeNull();
    expect(body.css).toBeNull();
  });

  it('creates, updates, publishes and clears a template block', async () => {
    const html =
      '<div class="quote"><p data-nv-text="title"></p><div data-nv-slot="main"></div></div>';
    const css = '.quote { border-left: 4px solid var(--nv-color-primary, #cc3d47); }';
    const created = await app.inject({
      method: 'POST',
      url: '/blocks',
      headers: { authorization: `Bearer ${editorToken}` },
      payload: {
        name: 'Quote',
        externalReferenceCode: 'quote',
        propsSchema: HERO_PROPS_SCHEMA,
        slots: [{ name: 'main' }],
        html,
        css,
      },
    });
    expect(created.statusCode).toBe(201);
    const createdBody = (created.json() as { data: BlockBody }).data;
    expect(createdBody.html).toBe(html);
    expect(createdBody.css).toBe(css);

    const read = await app.inject({
      method: 'GET',
      url: '/blocks/erc:quote',
      headers: { authorization: `Bearer ${editorToken}` },
    });
    expect((read.json() as { data: BlockBody }).data.html).toBe(html);

    const patchedHtml = '<blockquote class="quote" data-nv-text="title"></blockquote>';
    const patched = await app.inject({
      method: 'PATCH',
      url: '/blocks/erc:quote',
      headers: { authorization: `Bearer ${editorToken}` },
      payload: { html: patchedHtml },
    });
    expect(patched.statusCode).toBe(200);
    expect((patched.json() as { data: BlockBody }).data.html).toBe(patchedHtml);
    expect((patched.json() as { data: BlockBody }).data.css).toBe(css);

    const published = await app.inject({
      method: 'POST',
      url: '/blocks/erc:quote/publish',
      headers: { authorization: `Bearer ${editorToken}` },
    });
    expect(published.statusCode).toBe(200);
    const publishedBody = (published.json() as { data: BlockBody }).data;
    expect(publishedBody.status).toBe('PUBLISHED');
    expect(publishedBody.html).toBe(patchedHtml);

    const cleared = await app.inject({
      method: 'PATCH',
      url: '/blocks/erc:quote',
      headers: { authorization: `Bearer ${editorToken}` },
      payload: { html: null, css: null },
    });
    expect(cleared.statusCode).toBe(200);
    expect((cleared.json() as { data: BlockBody }).data.html).toBeNull();
    expect((cleared.json() as { data: BlockBody }).data.css).toBeNull();
  });

  it('rejects template constraint violations with 400 problem+json', async () => {
    async function attempt(payload: Record<string, unknown>): Promise<string> {
      const res = await app.inject({
        method: 'POST',
        url: '/blocks',
        headers: { authorization: `Bearer ${editorToken}` },
        payload: { name: 'Bad Template', propsSchema: HERO_PROPS_SCHEMA, ...payload },
      });
      expect(res.statusCode).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
      return (res.json() as { detail: string }).detail;
    }

    expect(await attempt({ html: '<div data-nv-text="title"><b>x</b></div>' })).toContain('leaf');
    expect(
      await attempt({ slots: [{ name: 'main' }], html: '<div data-nv-slot="main">x</div>' }),
    ).toContain('empty');
    expect(await attempt({ html: '<div data-nv-slot="ghost"></div>' })).toContain('not declared');
    expect(await attempt({ html: '<h1 data-nv-text="nope"></h1>' })).toContain(
      'does not exist in propsSchema.properties',
    );
    expect(await attempt({ html: '<script>x</script>' })).toContain('<script>');
    expect(await attempt({ html: '<a onclick="x">y</a>' })).toContain('onclick');
    expect(await attempt({ html: '<a href="javascript:x">y</a>' })).toContain('javascript:');
    expect(await attempt({ html: '<p>ok</p>', css: '@import url(x);' })).toContain('@import');
  });

  it('re-validates the stored template when a PATCH changes propsSchema or slots', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/blocks',
      headers: { authorization: `Bearer ${editorToken}` },
      payload: {
        name: 'Bound',
        externalReferenceCode: 'bound',
        propsSchema: HERO_PROPS_SCHEMA,
        html: '<h1 data-nv-text="title"></h1>',
      },
    });
    expect(created.statusCode).toBe(201);

    // Removing the bound prop from the schema would orphan the template.
    const res = await app.inject({
      method: 'PATCH',
      url: '/blocks/erc:bound',
      headers: { authorization: `Bearer ${editorToken}` },
      payload: { propsSchema: { type: 'object', properties: { other: { type: 'string' } } } },
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { detail: string }).detail).toContain('data-nv-text="title"');
  });

  it('deletes a block (204) and then returns 404', async () => {
    const del = await app.inject({
      method: 'DELETE',
      url: `/blocks/${heroId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(del.statusCode).toBe(204);

    const gone = await app.inject({
      method: 'GET',
      url: `/blocks/${heroId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(gone.statusCode).toBe(404);
  });
});
