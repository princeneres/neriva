import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DEMO_BLOCK_ERCS,
  DEMO_CONTENT_ENTRY_ERCS,
  DEMO_CONTENT_TYPE_ERC,
  DEMO_PAGE_ERC,
  DEMO_PAGE_TREE,
  DEMO_SITE_ERC,
  DEMO_STYLE_BOOK_ERC,
  DemoSeedService,
} from '../src/db/demo-seed.service';
import { blocks, contentEntries, contentTypes, pages, sites, styleBooks } from '../src/db/schema';
import { createTestApp } from './utils/test-app';
import { startTestDb, type TestDb } from './utils/test-db';

interface Tokens {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

interface SiteBody {
  id: string;
  name: string;
  slug: string;
  description: string;
}

interface StyleBookBody {
  name: string;
  version: number;
  status: string;
  tokens: Record<string, string>;
}

interface BlockBody {
  status: string;
  category: string | null;
  propsSchema: {
    required?: string[];
    properties?: Record<string, { title?: string }>;
  };
  slots: { name: string }[];
}

interface PageBody {
  title: string;
  path: string;
  status: string;
  siteId: string;
  tree: unknown;
}

interface ContentTypeBody {
  name: string;
  fields: unknown;
}

interface ContentEntryBody {
  status: string;
  siteId: string | null;
  values: Record<string, unknown>;
}

describe('demo content seed (e2e)', () => {
  let testDb: TestDb;
  let app: NestFastifyApplication;
  let adminToken: string;
  let demoSiteRowsWhenGated: number;
  let demoSiteId: string;

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

  async function asAdmin<T>(url: string): Promise<{ statusCode: number; data: T }> {
    const res = await app.inject({
      method: 'GET',
      url,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    return { statusCode: res.statusCode, data: (res.json() as { data: T }).data };
  }

  beforeAll(async () => {
    testDb = await startTestDb();

    // The gated path is checked against the pristine database, before the
    // app boots and seeds for real; afterwards a skip would be unobservable.
    process.env.SEED_DEMO = 'false';
    await new DemoSeedService(testDb.db).run();
    demoSiteRowsWhenGated = (
      await testDb.db.select().from(sites).where(eq(sites.externalReferenceCode, DEMO_SITE_ERC))
    ).length;
    delete process.env.SEED_DEMO;

    app = await createTestApp(testDb.connectionUri);
    adminToken = await loginFresh('admin@neriva.com', 'admin', 'admin-password-1');
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  it('skips demo seeding entirely when SEED_DEMO=false', () => {
    expect(demoSiteRowsWhenGated).toBe(0);
  });

  it('seeds the demo site', async () => {
    const { statusCode, data } = await asAdmin<SiteBody>(`/sites/erc:${DEMO_SITE_ERC}`);
    expect(statusCode).toBe(200);
    expect(data.name).toBe('Demo Site');
    expect(data.slug).toBe('demo');
    expect(data.description).toContain('Safe to delete');
    demoSiteId = data.id;
  });

  it('seeds the demo style book with the default tokens, PUBLISHED', async () => {
    const { statusCode, data } = await asAdmin<StyleBookBody>(
      `/style-books/erc:${DEMO_STYLE_BOOK_ERC}`,
    );
    expect(statusCode).toBe(200);
    expect(data.name).toBe('Neriva Default');
    expect(data.version).toBe(1);
    expect(data.status).toBe('PUBLISHED');
    expect(data.tokens).toEqual({
      'color-primary': '#cc3d47',
      'color-surface': '#faf9f7',
      'color-text': '#1a1917',
      'space-sm': '0.5rem',
      'space-md': '1rem',
      'space-lg': '2rem',
      'radius-md': '8px',
      'font-body': 'system-ui',
    });
  });

  it('seeds the four demo blocks, PUBLISHED', async () => {
    for (const erc of DEMO_BLOCK_ERCS) {
      const { statusCode, data } = await asAdmin<BlockBody>(`/blocks/erc:${erc}`);
      expect(statusCode).toBe(200);
      expect(data.status).toBe('PUBLISHED');
    }

    const hero = (await asAdmin<BlockBody>('/blocks/erc:hero')).data;
    expect(hero.category).toBe('content');
    expect(hero.propsSchema.required).toEqual(['heading']);
    expect(hero.propsSchema.properties?.heading?.title).toBe('Heading');

    const twoColumns = (await asAdmin<BlockBody>('/blocks/erc:two-columns')).data;
    expect(twoColumns.category).toBe('layout');
    expect(twoColumns.slots).toEqual([{ name: 'left' }, { name: 'right' }]);

    const image = (await asAdmin<BlockBody>('/blocks/erc:image')).data;
    expect(image.category).toBe('media');
    expect(image.propsSchema.required).toEqual(['url', 'alt']);
  });

  it('serves the demo home page with its tree intact', async () => {
    const { statusCode, data } = await asAdmin<PageBody>(`/pages/erc:${DEMO_PAGE_ERC}`);
    expect(statusCode).toBe(200);
    expect(data.title).toBe('Welcome to Neriva');
    expect(data.path).toBe('/');
    expect(data.status).toBe('PUBLISHED');
    expect(data.siteId).toBe(demoSiteId);
    expect(data.tree).toEqual(DEMO_PAGE_TREE);
  });

  it('seeds the Article content type and two published demo entries', async () => {
    const contentType = await asAdmin<ContentTypeBody>(
      `/content-types/erc:${DEMO_CONTENT_TYPE_ERC}`,
    );
    expect(contentType.statusCode).toBe(200);
    expect(contentType.data.name).toBe('Article');
    expect(contentType.data.fields).toEqual([
      { key: 'summary', label: 'Summary', type: 'text', required: true },
      { key: 'body', label: 'Body', type: 'richtext', required: true },
      { key: 'publishedOn', label: 'Published on', type: 'date', required: false },
    ]);

    for (const erc of DEMO_CONTENT_ENTRY_ERCS) {
      const { statusCode, data } = await asAdmin<ContentEntryBody>(`/content-entries/erc:${erc}`);
      expect(statusCode).toBe(200);
      expect(data.status).toBe('PUBLISHED');
      expect(data.siteId).toBe(demoSiteId);
      expect(typeof data.values.summary).toBe('string');
      expect(typeof data.values.body).toBe('string');
    }

    const list = await app.inject({
      method: 'GET',
      url: `/content-entries?contentType=erc:${DEMO_CONTENT_TYPE_ERC}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(list.statusCode).toBe(200);
    expect((list.json() as { data: unknown[] }).data).toHaveLength(2);
  });

  it('does not duplicate demo content when the app boots a second time', async () => {
    const secondApp = await createTestApp(testDb.connectionUri);
    await secondApp.close();

    const [siteRows, blockRows, pageRows, styleBookRows, typeRows, entryRows] = await Promise.all([
      testDb.db.select().from(sites).where(eq(sites.externalReferenceCode, DEMO_SITE_ERC)),
      testDb.db
        .select()
        .from(blocks)
        .where(inArray(blocks.externalReferenceCode, [...DEMO_BLOCK_ERCS])),
      testDb.db.select().from(pages).where(eq(pages.externalReferenceCode, DEMO_PAGE_ERC)),
      testDb.db
        .select()
        .from(styleBooks)
        .where(eq(styleBooks.externalReferenceCode, DEMO_STYLE_BOOK_ERC)),
      testDb.db
        .select()
        .from(contentTypes)
        .where(eq(contentTypes.externalReferenceCode, DEMO_CONTENT_TYPE_ERC)),
      testDb.db
        .select()
        .from(contentEntries)
        .where(inArray(contentEntries.externalReferenceCode, [...DEMO_CONTENT_ENTRY_ERCS])),
    ]);
    expect(siteRows).toHaveLength(1);
    expect(blockRows).toHaveLength(DEMO_BLOCK_ERCS.length);
    expect(pageRows).toHaveLength(1);
    expect(styleBookRows).toHaveLength(1);
    expect(typeRows).toHaveLength(1);
    expect(entryRows).toHaveLength(DEMO_CONTENT_ENTRY_ERCS.length);
  });
});
