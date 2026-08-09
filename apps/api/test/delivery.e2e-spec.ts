import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO_PAGE_ERC, DEMO_PAGE_TREE, DEMO_SITE_ERC } from '../src/db/demo-seed.service';
import { MASTER_DEFAULT_ERC } from '../src/db/native-master-page-seed.service';
import type { PageTree } from '../src/db/schema';
import { composePageTree } from '../src/modules/pages/page-composition';
import { collectBlockRefs } from '../src/modules/pages/page-tree.validation';
import { createTestApp } from './utils/test-app';
import { startTestDb, type TestDb } from './utils/test-db';

interface Tokens {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

interface DeliveredBlock {
  name: string;
  category: string | null;
  slots: { name: string }[];
}

interface DeliveredPageBody {
  data: {
    site: { name: string; slug: string };
    page: { title: string; path: string; tree: unknown; updatedAt: string };
    blocks: Record<string, DeliveredBlock>;
  };
}

interface DeliveredPageListBody {
  data: { title: string; path: string; updatedAt: string }[];
  meta: { cursor: string | null; limit: number };
}

describe('public delivery API (e2e)', () => {
  let testDb: TestDb;
  let app: NestFastifyApplication;
  let adminToken: string;
  let defaultMasterTree: PageTree;

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

    // A DRAFT page in the demo site; delivery must not expose it.
    const draft = await app.inject({
      method: 'POST',
      url: `/sites/erc:${DEMO_SITE_ERC}/pages`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { title: 'Draft page', path: '/draft-page' },
    });
    expect(draft.statusCode).toBe(201);
    expect((draft.json() as { data: { status: string } }).data.status).toBe('DRAFT');

    // The seeded default master (spec 14); no page in this suite sets its
    // own masterPageTemplateId, so every published page composes with it.
    const master = await app.inject({
      method: 'GET',
      url: `/page-templates/erc:${MASTER_DEFAULT_ERC}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(master.statusCode).toBe(200);
    defaultMasterTree = (master.json() as { data: { tree: PageTree } }).data.tree;
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  it('serves the published demo page composed with the resolved default master (spec 14)', async () => {
    const res = await app.inject({ method: 'GET', url: '/public/sites/demo/page' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as DeliveredPageBody;
    expect(body.data.site).toEqual({ name: 'Demo Site', slug: 'demo' });
    expect(body.data.page.title).toBe('Welcome to Neriva');
    expect(body.data.page.path).toBe('/');
    expect(body.data.page.tree).toEqual(composePageTree(defaultMasterTree, DEMO_PAGE_TREE));
    // Sanity: the demo page's own tree is unchanged by delivery, it is only
    // the response that is composed.
    expect(body.data.page.tree).not.toEqual(DEMO_PAGE_TREE);
    expect(typeof body.data.page.updatedAt).toBe('string');
  });

  it('maps every block ERC referenced in the composed tree, without propsSchema', async () => {
    const res = await app.inject({ method: 'GET', url: '/public/sites/demo/page' });
    expect(res.statusCode).toBe(200);
    const blocks = (res.json() as DeliveredPageBody).data.blocks;

    const composedTree = composePageTree(defaultMasterTree, DEMO_PAGE_TREE);
    const refs = collectBlockRefs(composedTree);
    expect(refs.length).toBeGreaterThan(0);
    for (const erc of refs) {
      expect(blocks[erc]).toBeDefined();
      expect(blocks[erc]).not.toHaveProperty('propsSchema');
    }
    expect(blocks.hero).toEqual({ name: 'Hero', category: 'content', slots: [] });
    expect(blocks['two-columns']?.slots).toEqual([{ name: 'left' }, { name: 'right' }]);
    // The master's chrome blocks are unioned in too.
    expect(blocks['nv-container']).toEqual({
      name: 'Container',
      category: 'layout',
      slots: [{ name: 'content' }],
    });
    expect(blocks['nv-heading']).toBeDefined();
    expect(blocks['nv-paragraph']).toBeDefined();
  });

  it('returns 404 for a DRAFT page, indistinguishable from a missing path', async () => {
    const draft = await app.inject({
      method: 'GET',
      url: '/public/sites/demo/page',
      query: { path: '/draft-page' },
    });
    expect(draft.statusCode).toBe(404);
    expect(draft.headers['content-type']).toContain('application/problem+json');

    const missing = await app.inject({
      method: 'GET',
      url: '/public/sites/demo/page',
      query: { path: '/no-such-page' },
    });
    expect(missing.statusCode).toBe(404);

    const draftBody = draft.json() as { status: number; detail: string };
    const missingBody = missing.json() as { status: number; detail: string };
    expect(draftBody.detail).toBe(missingBody.detail);
  });

  it('returns 404 for an unknown site slug', async () => {
    const res = await app.inject({ method: 'GET', url: '/public/sites/no-such-site/page' });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('lists only PUBLISHED pages with the standard pagination envelope', async () => {
    const res = await app.inject({ method: 'GET', url: '/public/sites/demo/pages' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as DeliveredPageListBody;
    const paths = body.data.map((page) => page.path);
    expect(paths).toContain('/');
    expect(paths).not.toContain('/draft-page');
    expect(body.data[0]).not.toHaveProperty('status');
    expect(body.data[0]).not.toHaveProperty('id');
    expect(body.meta.cursor).toBeNull();
    expect(body.meta.limit).toBe(20);
  });

  it('serves style.css from the latest published Style Book as text/css', async () => {
    const res = await app.inject({ method: 'GET', url: '/public/sites/demo/style.css' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/css');
    expect(res.body.startsWith(':root {')).toBe(true);
    expect(res.body).toContain('--nv-color-primary: #cc3d47;');
    expect(res.body.trimEnd().endsWith('}')).toBe(true);
  });

  it('keeps the management API behind authentication', async () => {
    const res = await app.inject({ method: 'GET', url: `/pages/erc:${DEMO_PAGE_ERC}` });
    expect(res.statusCode).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });
});
