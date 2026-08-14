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
  html: string | null;
  css: string | null;
}

interface DeliveredPageBody {
  data: {
    site: { name: string; slug: string; pages: { title: string; path: string }[] };
    page: { title: string; path: string; tree: unknown; updatedAt: string };
    blocks: Record<string, DeliveredBlock>;
  };
}

interface DeliveredPageListBody {
  data: { title: string; path: string; updatedAt: string }[];
  meta: { cursor: string | null; limit: number };
}

interface DeliveredContentEntry {
  id: string;
  externalReferenceCode: string;
  title: string;
  contentType: string;
  values: Record<string, unknown>;
  updatedAt: string;
}

interface DeliveredContentEntryListBody {
  data: DeliveredContentEntry[];
  meta: { cursor: string | null; limit: number };
}

// Own fixtures for the public content-entry listing, kept apart from the
// demo seed's "article" entries so the filtered assertions are exact.
const POST_TYPE_ERC = 'delivery-post';
const NOTE_TYPE_ERC = 'delivery-note';
const PUBLISHED_POST_ERCS = [
  'delivery-post-alpha',
  'delivery-post-beta',
  'delivery-post-gamma',
] as const;
const DRAFT_POST_ERC = 'delivery-post-draft';
const TENANT_WIDE_POST_ERC = 'delivery-post-tenant-wide';
const NOTE_ERC = 'delivery-note-one';

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

  function asAdmin(options: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    url: string;
    payload?: Record<string, unknown>;
  }) {
    return app.inject({ ...options, headers: { authorization: `Bearer ${adminToken}` } });
  }

  // Creates an entry and publishes it unless publish=false, so the fixture
  // ids follow creation order (UUIDv7) and the newest-first expectations are
  // the reverse of this call order.
  async function createEntry(input: {
    erc: string;
    contentType: string;
    title: string;
    values: Record<string, unknown>;
    site?: string;
    publish?: boolean;
  }): Promise<void> {
    const created = await asAdmin({
      method: 'POST',
      url: '/content-entries',
      payload: {
        contentType: `erc:${input.contentType}`,
        site: input.site,
        title: input.title,
        values: input.values,
        externalReferenceCode: input.erc,
      },
    });
    expect(created.statusCode).toBe(201);
    expect((created.json() as { data: { status: string } }).data.status).toBe('DRAFT');
    if (input.publish === false) {
      return;
    }
    const published = await asAdmin({
      method: 'POST',
      url: `/content-entries/erc:${input.erc}/publish`,
    });
    expect(published.statusCode).toBe(200);
    expect((published.json() as { data: { status: string } }).data.status).toBe('PUBLISHED');
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

    // Content entry fixtures for the public listing: two content types, three
    // published posts in the demo site, one DRAFT post, one tenant-wide post
    // and one note.
    for (const type of [
      { erc: POST_TYPE_ERC, name: 'Delivery Post' },
      { erc: NOTE_TYPE_ERC, name: 'Delivery Note' },
    ]) {
      const created = await asAdmin({
        method: 'POST',
        url: '/content-types',
        payload: {
          name: type.name,
          externalReferenceCode: type.erc,
          fields: [
            { key: 'summary', label: 'Summary', type: 'text', required: true },
            { key: 'body', label: 'Body', type: 'richtext', required: false },
          ],
        },
      });
      expect(created.statusCode).toBe(201);
    }

    await createEntry({
      erc: PUBLISHED_POST_ERCS[0],
      contentType: POST_TYPE_ERC,
      site: `erc:${DEMO_SITE_ERC}`,
      title: 'Alpha release notes',
      values: { summary: 'The alpha ships with kiwi support.', body: '<p>Alpha body</p>' },
    });
    await createEntry({
      erc: PUBLISHED_POST_ERCS[1],
      contentType: POST_TYPE_ERC,
      site: `erc:${DEMO_SITE_ERC}`,
      title: 'Beta release notes',
      values: { summary: 'The beta adds mango support.', body: '<p>Beta body</p>' },
    });
    await createEntry({
      erc: PUBLISHED_POST_ERCS[2],
      contentType: POST_TYPE_ERC,
      site: `erc:${DEMO_SITE_ERC}`,
      title: 'Gamma release notes',
      values: { summary: 'The third batch polishes the rough edges.', body: '<p>Third body</p>' },
    });
    await createEntry({
      erc: DRAFT_POST_ERC,
      contentType: POST_TYPE_ERC,
      site: `erc:${DEMO_SITE_ERC}`,
      title: 'Unfinished draft post',
      values: { summary: 'Not ready for the public yet.' },
      publish: false,
    });
    // No site: a tenant-wide entry, which the site listing must not surface.
    await createEntry({
      erc: TENANT_WIDE_POST_ERC,
      contentType: POST_TYPE_ERC,
      title: 'Tenant wide post',
      values: { summary: 'Belongs to no site.' },
    });
    await createEntry({
      erc: NOTE_ERC,
      contentType: NOTE_TYPE_ERC,
      site: `erc:${DEMO_SITE_ERC}`,
      title: 'A note, not a post',
      values: { summary: 'Different content type.' },
    });
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  it('serves the published demo page composed with the resolved default master (spec 14)', async () => {
    const res = await app.inject({ method: 'GET', url: '/public/sites/demo/page' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as DeliveredPageBody;
    expect(body.data.site).toMatchObject({ name: 'Demo Site', slug: 'demo' });
    expect(body.data.site.pages).toContainEqual({ title: 'Welcome to Neriva', path: '/' });
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
      expect(blocks[erc]).toHaveProperty('html');
      expect(blocks[erc]).toHaveProperty('css');
    }
    // The home page is built from the native library, so the map carries its
    // blocks: a slotted layout block and a plain content one.
    expect(blocks['nv-columns-3']?.slots).toEqual([{ name: 'a' }, { name: 'b' }, { name: 'c' }]);
    expect(blocks['nv-heading']).toMatchObject({ name: 'Heading', category: 'basic', slots: [] });
    // The master's chrome blocks are unioned in too. (html/css already
    // asserted generically above; these native blocks ship real templates.)
    expect(blocks['nv-header']).toMatchObject({ name: 'Header', category: 'layout' });
    expect(blocks['nv-footer']).toMatchObject({ name: 'Footer', category: 'layout' });
  });

  it('exposes the demo block templates (html and css, spec 12)', async () => {
    const res = await app.inject({ method: 'GET', url: '/public/sites/demo/page' });
    expect(res.statusCode).toBe(200);
    const blocks = (res.json() as DeliveredPageBody).data.blocks;
    expect(blocks['nv-heading']?.html).toContain('data-nv-text="text"');
    expect(blocks['nv-button']?.css).toContain('var(--nv-color-primary, #cc3d47)');
    expect(blocks['nv-columns-3']?.html).toContain('data-nv-slot="a"');
  });

  // The two data-driven blocks are rendered by the runtime registry, so they
  // ship with no template and the map has to say so rather than omitting them.
  it('maps the registry-rendered blocks with null templates', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/public/sites/demo/page',
      query: { path: '/blog' },
    });
    expect(res.statusCode).toBe(200);
    const blocks = (res.json() as DeliveredPageBody).data.blocks;
    expect(blocks['nv-post-list']).toMatchObject({ name: 'Post List', html: null, css: null });
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

  it('lists PUBLISHED site content entries anonymously, with their values intact', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/public/sites/demo/content-entries',
      query: { contentType: `erc:${POST_TYPE_ERC}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as DeliveredContentEntryListBody;
    const alpha = body.data.find((entry) => entry.externalReferenceCode === PUBLISHED_POST_ERCS[0]);
    expect(alpha).toBeDefined();
    expect(alpha?.title).toBe('Alpha release notes');
    expect(alpha?.contentType).toBe(POST_TYPE_ERC);
    expect(alpha?.values).toEqual({
      summary: 'The alpha ships with kiwi support.',
      body: '<p>Alpha body</p>',
    });
    expect(typeof alpha?.updatedAt).toBe('string');
    // Delivery exposes the render payload only, not the management envelope.
    expect(Object.keys(alpha ?? {}).sort()).toEqual([
      'contentType',
      'externalReferenceCode',
      'id',
      'title',
      'updatedAt',
      'values',
    ]);
    expect(body.meta.limit).toBe(20);
  });

  it('excludes DRAFT entries and entries that belong to no site', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/public/sites/demo/content-entries',
      query: { contentType: `erc:${POST_TYPE_ERC}` },
    });
    expect(res.statusCode).toBe(200);
    const ercs = (res.json() as DeliveredContentEntryListBody).data.map(
      (entry) => entry.externalReferenceCode,
    );
    expect(ercs).not.toContain(DRAFT_POST_ERC);
    // PUBLISHED but tenant-wide (siteId null): site listings stay predictable.
    expect(ercs).not.toContain(TENANT_WIDE_POST_ERC);
    expect(ercs).toEqual([...PUBLISHED_POST_ERCS].reverse());
  });

  it('narrows by contentType and returns an empty list for an unknown content type', async () => {
    const unfiltered = await app.inject({
      method: 'GET',
      url: '/public/sites/demo/content-entries',
      query: { limit: '100' },
    });
    expect(unfiltered.statusCode).toBe(200);
    const allErcs = (unfiltered.json() as DeliveredContentEntryListBody).data.map(
      (entry) => entry.externalReferenceCode,
    );
    expect(allErcs).toContain(NOTE_ERC);
    expect(allErcs).toContain(PUBLISHED_POST_ERCS[0]);

    const notes = await app.inject({
      method: 'GET',
      url: '/public/sites/demo/content-entries',
      query: { contentType: `erc:${NOTE_TYPE_ERC}` },
    });
    expect(notes.statusCode).toBe(200);
    const noteBody = notes.json() as DeliveredContentEntryListBody;
    expect(noteBody.data.map((entry) => entry.externalReferenceCode)).toEqual([NOTE_ERC]);
    expect(noteBody.data[0]?.contentType).toBe(NOTE_TYPE_ERC);

    // Unknown content type: an empty page, not a 404, so the endpoint never
    // reveals which content types exist.
    for (const ref of ['erc:no-such-content-type', '0195d9c6-0000-7000-8000-000000000000']) {
      const unknown = await app.inject({
        method: 'GET',
        url: '/public/sites/demo/content-entries',
        query: { contentType: ref },
      });
      expect(unknown.statusCode).toBe(200);
      const unknownBody = unknown.json() as DeliveredContentEntryListBody;
      expect(unknownBody.data).toEqual([]);
      expect(unknownBody.meta.cursor).toBeNull();
      expect(unknownBody.meta.limit).toBe(20);
    }
  });

  it('searches case-insensitively across the title and the values payload', async () => {
    const byTitle = await app.inject({
      method: 'GET',
      url: '/public/sites/demo/content-entries',
      query: { q: 'gamma RELEASE' },
    });
    expect(byTitle.statusCode).toBe(200);
    expect(
      (byTitle.json() as DeliveredContentEntryListBody).data.map(
        (entry) => entry.externalReferenceCode,
      ),
    ).toEqual([PUBLISHED_POST_ERCS[2]]);

    // "kiwi" only exists inside the alpha post's values.
    const byValue = await app.inject({
      method: 'GET',
      url: '/public/sites/demo/content-entries',
      query: { q: 'KIWI' },
    });
    expect(byValue.statusCode).toBe(200);
    expect(
      (byValue.json() as DeliveredContentEntryListBody).data.map(
        (entry) => entry.externalReferenceCode,
      ),
    ).toEqual([PUBLISHED_POST_ERCS[0]]);

    const noMatch = await app.inject({
      method: 'GET',
      url: '/public/sites/demo/content-entries',
      query: { q: 'nothing-matches-this-term' },
    });
    expect(noMatch.statusCode).toBe(200);
    expect((noMatch.json() as DeliveredContentEntryListBody).data).toEqual([]);
  });

  it('paginates newest first, walking the whole set without duplicates or gaps', async () => {
    const first = await app.inject({
      method: 'GET',
      url: '/public/sites/demo/content-entries',
      query: { contentType: `erc:${POST_TYPE_ERC}`, limit: '2' },
    });
    expect(first.statusCode).toBe(200);
    const firstBody = first.json() as DeliveredContentEntryListBody;
    expect(firstBody.meta.limit).toBe(2);
    expect(firstBody.data.map((entry) => entry.externalReferenceCode)).toEqual([
      PUBLISHED_POST_ERCS[2],
      PUBLISHED_POST_ERCS[1],
    ]);
    expect(firstBody.meta.cursor).not.toBeNull();

    const second = await app.inject({
      method: 'GET',
      url: '/public/sites/demo/content-entries',
      query: {
        contentType: `erc:${POST_TYPE_ERC}`,
        limit: '2',
        cursor: firstBody.meta.cursor ?? '',
      },
    });
    expect(second.statusCode).toBe(200);
    const secondBody = second.json() as DeliveredContentEntryListBody;
    expect(secondBody.data.map((entry) => entry.externalReferenceCode)).toEqual([
      PUBLISHED_POST_ERCS[0],
    ]);
    expect(secondBody.meta.cursor).toBeNull();

    // UUIDv7 ids are time-ordered, so newest first is strictly descending ids.
    const walked = [...firstBody.data, ...secondBody.data].map((entry) => entry.id);
    expect(new Set(walked).size).toBe(walked.length);
    expect([...walked].sort((a, b) => (a < b ? 1 : -1))).toEqual(walked);
  });

  it('returns 404 for content entries of an unknown site slug', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/public/sites/no-such-site/content-entries',
    });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });

  it('keeps the management API behind authentication', async () => {
    const res = await app.inject({ method: 'GET', url: `/pages/erc:${DEMO_PAGE_ERC}` });
    expect(res.statusCode).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
  });
});
