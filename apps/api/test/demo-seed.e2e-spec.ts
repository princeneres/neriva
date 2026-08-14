import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq, inArray } from 'drizzle-orm';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DEMO_BLOCK_ERCS,
  DEMO_BLOG_PAGE_ERC,
  DEMO_BLOG_PAGE_TREE,
  DEMO_CONTENT_ENTRY_ERCS,
  DEMO_CONTENT_TYPE_ERC,
  DEMO_MEDIA_FILE_ERCS,
  DEMO_MEDIA_FOLDER_ERC,
  DEMO_OBJECT_DEFINITION_ERC,
  DEMO_OBJECT_RECORD_ERCS,
  DEMO_PAGE_ERC,
  DEMO_PAGE_TREE,
  DEMO_TODO_PAGE_ERC,
  DEMO_TODO_PAGE_TREE,
  DEMO_SITE_ERC,
  DEMO_STYLE_BOOK_ERC,
  DemoSeedService,
} from '../src/db/demo-seed.service';
import {
  blocks,
  contentEntries,
  contentTypes,
  mediaFiles,
  mediaFolders,
  objectDefinitions,
  objectRecords,
  pages,
  sites,
  styleBooks,
} from '../src/db/schema';
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
  html: string | null;
  css: string | null;
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

interface ObjectDefinitionBody {
  name: string;
  pluralName: string;
  fields: { key: string; label: string; type: string; required: boolean }[];
}

interface ObjectRecordBody {
  objectDefinitionId: string;
  data: Record<string, unknown>;
}

interface MediaFolderBody {
  externalReferenceCode: string;
  name: string;
  parentId: string | null;
}

interface MediaFileBody {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  alt: string | null;
  url: string;
}

describe('demo content seed (e2e)', () => {
  let testDb: TestDb;
  let app: NestFastifyApplication;
  let adminToken: string;
  let demoSiteRowsWhenGated: number;
  let demoSiteId: string;
  let storageDir: string;

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

    // The real seed run below writes the demo post covers to disk: an
    // isolated tmp dir keeps that out of the repo's own ./uploads folder.
    storageDir = mkdtempSync(join(tmpdir(), 'neriva-demo-seed-e2e-'));
    process.env.MEDIA_STORAGE_DIR = storageDir;

    app = await createTestApp(testDb.connectionUri);
    adminToken = await loginFresh('admin@neriva.com', 'admin', 'admin-password-1');
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
    delete process.env.MEDIA_STORAGE_DIR;
    rmSync(storageDir, { recursive: true, force: true });
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
      'color-surface-alt': '#f1efec',
      'color-text': '#1a1917',
      'color-border': '#e5e3df',
      'space-sm': '0.5rem',
      'space-md': '1rem',
      'space-lg': '2rem',
      'radius-md': '8px',
      'font-body': 'system-ui',
    });
  });

  it('seeds the five demo blocks, PUBLISHED, with templates (spec 12)', async () => {
    for (const erc of DEMO_BLOCK_ERCS) {
      const { statusCode, data } = await asAdmin<BlockBody>(`/blocks/erc:${erc}`);
      expect(statusCode).toBe(200);
      expect(data.status).toBe('PUBLISHED');
      expect(data.html).toBeTruthy();
      expect(data.css).toBeTruthy();
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

    const linkCard = (await asAdmin<BlockBody>('/blocks/erc:link-card')).data;
    expect(linkCard.category).toBe('content');
    expect(linkCard.propsSchema.required).toEqual(['heading', 'linkLabel', 'linkUrl']);
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

  it('serves the Blog and To Do List demo pages with their trees intact', async () => {
    const blog = await asAdmin<PageBody>(`/pages/erc:${DEMO_BLOG_PAGE_ERC}`);
    expect(blog.statusCode).toBe(200);
    expect(blog.data.title).toBe('Blog');
    expect(blog.data.path).toBe('/blog');
    expect(blog.data.status).toBe('PUBLISHED');
    expect(blog.data.siteId).toBe(demoSiteId);
    expect(blog.data.tree).toEqual(DEMO_BLOG_PAGE_TREE);

    const todo = await asAdmin<PageBody>(`/pages/erc:${DEMO_TODO_PAGE_ERC}`);
    expect(todo.statusCode).toBe(200);
    expect(todo.data.title).toBe('To Do List');
    expect(todo.data.path).toBe('/todo');
    expect(todo.data.status).toBe('PUBLISHED');
    expect(todo.data.siteId).toBe(demoSiteId);
    expect(todo.data.tree).toEqual(DEMO_TODO_PAGE_TREE);
  });

  // Media is demonstrated through the blog thumbnails now, so the standalone
  // page is gone and the site is down to three pages.
  it('seeds no standalone Media page', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/sites/${demoSiteId}/pages?limit=100`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const paths = (res.json() as { data: { path: string }[] }).data.map((page) => page.path);
    expect(paths.sort()).toEqual(['/', '/blog', '/todo']);
  });

  it('drives the list and the to do page from the two registry-rendered blocks', () => {
    const blogRefs = DEMO_BLOG_PAGE_TREE.blocks.map((node) => node.block);
    expect(blogRefs).toContain('nv-post-list');
    const todoRefs = DEMO_TODO_PAGE_TREE.blocks.map((node) => node.block);
    expect(todoRefs).toContain('nv-todo-list');
  });

  it('seeds the Article content type and six published demo posts', async () => {
    const contentType = await asAdmin<ContentTypeBody>(
      `/content-types/erc:${DEMO_CONTENT_TYPE_ERC}`,
    );
    expect(contentType.statusCode).toBe(200);
    expect(contentType.data.name).toBe('Article');
    expect(contentType.data.fields).toEqual([
      { key: 'summary', label: 'Summary', type: 'text', required: true },
      { key: 'body', label: 'Body', type: 'richtext', required: true },
      { key: 'publishedOn', label: 'Published on', type: 'date', required: false },
      { key: 'thumbnail', label: 'Thumbnail URL', type: 'text', required: false },
    ]);

    for (const erc of DEMO_CONTENT_ENTRY_ERCS) {
      const { statusCode, data } = await asAdmin<ContentEntryBody>(`/content-entries/erc:${erc}`);
      expect(statusCode).toBe(200);
      expect(data.status).toBe('PUBLISHED');
      expect(data.siteId).toBe(demoSiteId);
      expect(typeof data.values.summary).toBe('string');
      expect(typeof data.values.body).toBe('string');
      // Every post carries a thumbnail pointing at a seeded media file, which
      // is how media is demonstrated now that it has no page of its own.
      expect(data.values.thumbnail).toMatch(/^\/public\/media\/erc:demo-cover-/);
    }

    const list = await app.inject({
      method: 'GET',
      url: `/content-entries?contentType=erc:${DEMO_CONTENT_TYPE_ERC}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(list.statusCode).toBe(200);
    expect((list.json() as { data: unknown[] }).data).toHaveLength(DEMO_CONTENT_ENTRY_ERCS.length);
  });

  it('seeds the Task object definition and its example records', async () => {
    const definition = await asAdmin<ObjectDefinitionBody>(
      `/object-definitions/erc:${DEMO_OBJECT_DEFINITION_ERC}`,
    );
    expect(definition.statusCode).toBe(200);
    expect(definition.data.name).toBe('Task');
    expect(definition.data.pluralName).toBe('Tasks');
    expect(definition.data.fields.map((field) => field.key)).toEqual([
      'title',
      'priority',
      'done',
      'dueDate',
    ]);

    for (const erc of DEMO_OBJECT_RECORD_ERCS) {
      const { statusCode, data } = await asAdmin<ObjectRecordBody>(`/object-records/erc:${erc}`);
      expect(statusCode).toBe(200);
      expect(typeof data.data.title).toBe('string');
    }

    const records = await asAdmin<ObjectRecordBody[]>(
      `/object-definitions/erc:${DEMO_OBJECT_DEFINITION_ERC}/records`,
    );
    expect(records.statusCode).toBe(200);
    expect(records.data).toHaveLength(DEMO_OBJECT_RECORD_ERCS.length);
  });

  it('seeds the Demo Media folder with real post covers served from /public/media', async () => {
    // Folders have no single-item GET (spec 11): list the root and find it.
    const rootFolders = await asAdmin<MediaFolderBody[]>('/media/folders?parent=root');
    const folder = rootFolders.data.find(
      (candidate) => candidate.externalReferenceCode === DEMO_MEDIA_FOLDER_ERC,
    );
    expect(rootFolders.statusCode).toBe(200);
    expect(folder?.name).toBe('Demo Media');
    expect(folder?.parentId).toBeNull();

    for (const erc of DEMO_MEDIA_FILE_ERCS) {
      const { statusCode, data } = await asAdmin<MediaFileBody>(`/media/files/erc:${erc}`);
      expect(statusCode).toBe(200);
      expect(data.contentType).toBe('image/svg+xml');
      expect(data.sizeBytes).toBeGreaterThan(0);
      expect(data.alt).toBeTruthy();

      // The bytes are real, written by the seed itself (not a placeholder
      // URL): the public content endpoint must actually serve them.
      const stream = await app.inject({ method: 'GET', url: data.url });
      expect(stream.statusCode).toBe(200);
      expect(stream.headers['content-type']).toContain('image/svg+xml');
      expect(stream.body).toContain('<svg');
    }
  });

  it('does not duplicate demo content when the app boots a second time', async () => {
    const secondApp = await createTestApp(testDb.connectionUri);
    await secondApp.close();

    const [
      siteRows,
      blockRows,
      pageRows,
      styleBookRows,
      typeRows,
      entryRows,
      objectDefinitionRows,
      objectRecordRows,
      mediaFolderRows,
      mediaFileRows,
    ] = await Promise.all([
      testDb.db.select().from(sites).where(eq(sites.externalReferenceCode, DEMO_SITE_ERC)),
      testDb.db
        .select()
        .from(blocks)
        .where(inArray(blocks.externalReferenceCode, [...DEMO_BLOCK_ERCS])),
      testDb.db
        .select()
        .from(pages)
        .where(
          inArray(pages.externalReferenceCode, [
            DEMO_PAGE_ERC,
            DEMO_BLOG_PAGE_ERC,
            DEMO_TODO_PAGE_ERC,
          ]),
        ),
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
      testDb.db
        .select()
        .from(objectDefinitions)
        .where(eq(objectDefinitions.externalReferenceCode, DEMO_OBJECT_DEFINITION_ERC)),
      testDb.db
        .select()
        .from(objectRecords)
        .where(inArray(objectRecords.externalReferenceCode, [...DEMO_OBJECT_RECORD_ERCS])),
      testDb.db
        .select()
        .from(mediaFolders)
        .where(eq(mediaFolders.externalReferenceCode, DEMO_MEDIA_FOLDER_ERC)),
      testDb.db
        .select()
        .from(mediaFiles)
        .where(inArray(mediaFiles.externalReferenceCode, [...DEMO_MEDIA_FILE_ERCS])),
    ]);
    expect(siteRows).toHaveLength(1);
    expect(blockRows).toHaveLength(DEMO_BLOCK_ERCS.length);
    expect(pageRows).toHaveLength(3);
    expect(styleBookRows).toHaveLength(1);
    expect(typeRows).toHaveLength(1);
    expect(entryRows).toHaveLength(DEMO_CONTENT_ENTRY_ERCS.length);
    expect(objectDefinitionRows).toHaveLength(1);
    expect(objectRecordRows).toHaveLength(DEMO_OBJECT_RECORD_ERCS.length);
    expect(mediaFolderRows).toHaveLength(1);
    expect(mediaFileRows).toHaveLength(DEMO_MEDIA_FILE_ERCS.length);
  });
});
