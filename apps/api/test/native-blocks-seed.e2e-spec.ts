import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NATIVE_BLOCK_ERCS, NativeBlocksSeedService } from '../src/db/native-blocks-seed.service';
import { blocks } from '../src/db/schema';
import { createTestApp } from './utils/test-app';
import { startTestDb, type TestDb } from './utils/test-db';

interface Tokens {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

interface BlockBody {
  externalReferenceCode: string;
  status: string;
  name: string;
  category: string | null;
  description: string | null;
  propsSchema: { properties?: Record<string, { title?: string; enum?: string[] }> };
  slots: { name: string }[];
  html: string | null;
  css: string | null;
}

describe('native blocks seed (e2e)', () => {
  let testDb: TestDb;
  let app: NestFastifyApplication;
  let adminToken: string;
  let nativeRowsWhenGated: number;

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

  async function getBlock(erc: string): Promise<BlockBody> {
    const res = await app.inject({
      method: 'GET',
      url: `/blocks/erc:${erc}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    return (res.json() as { data: BlockBody }).data;
  }

  beforeAll(async () => {
    testDb = await startTestDb();

    // The gated path is checked against the pristine database, before the
    // app boots and seeds for real; afterwards a skip would be unobservable.
    // run() is exercised directly because the gate returns before the
    // default-tenant wait, so no first-boot seed is needed yet.
    process.env.SEED_NATIVE_BLOCKS = 'false';
    await new NativeBlocksSeedService(testDb.db).run();
    nativeRowsWhenGated = (
      await testDb.db
        .select()
        .from(blocks)
        .where(inArray(blocks.externalReferenceCode, [...NATIVE_BLOCK_ERCS]))
    ).length;
    delete process.env.SEED_NATIVE_BLOCKS;

    app = await createTestApp(testDb.connectionUri);
    adminToken = await loginFresh('admin@neriva.com', 'admin', 'admin-password-1');
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
  });

  it('skips seeding entirely when SEED_NATIVE_BLOCKS=false', () => {
    expect(nativeRowsWhenGated).toBe(0);
  });

  it('seeds all twelve native blocks, PUBLISHED, with html and css templates', async () => {
    expect(NATIVE_BLOCK_ERCS).toHaveLength(12);
    for (const erc of NATIVE_BLOCK_ERCS) {
      const block = await getBlock(erc);
      expect(block.status).toBe('PUBLISHED');
      expect(block.html).toBeTruthy();
      expect(block.css).toBeTruthy();
      expect(block.category).toBeTruthy();
      expect(block.description).toBeTruthy();
    }
  });

  it('exposes the templates through GET /blocks (html non-null)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/blocks?status=PUBLISHED&limit=100',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const list = (res.json() as { data: BlockBody[] }).data;
    const byErc = new Map(list.map((b) => [b.externalReferenceCode, b]));
    for (const erc of NATIVE_BLOCK_ERCS) {
      const block = byErc.get(erc);
      expect(block, `native block ${erc} missing from the list`).toBeDefined();
      expect(block?.html).not.toBeNull();
      expect(block?.css).not.toBeNull();
    }
  });

  it('declares the spec 12 shapes: categories, slots, prop titles and hooks', async () => {
    const container = await getBlock('nv-container');
    expect(container.category).toBe('layout');
    expect(container.slots).toEqual([{ name: 'content' }]);
    expect(container.propsSchema.properties?.background?.title).toBe('Background');

    const columns2 = await getBlock('nv-columns-2');
    expect(columns2.slots.map((s) => s.name)).toEqual(['left', 'right']);
    const columns3 = await getBlock('nv-columns-3');
    expect(columns3.slots.map((s) => s.name)).toEqual(['a', 'b', 'c']);

    const heading = await getBlock('nv-heading');
    expect(heading.category).toBe('basic');
    expect(heading.propsSchema.properties?.level?.enum).toEqual(['h1', 'h2', 'h3', 'h4']);
    expect(heading.html).toContain('data-nv-text="text"');
    expect(heading.html).toContain('{{level}}');

    const button = await getBlock('nv-button');
    expect(button.propsSchema.properties?.variant?.enum).toEqual(['primary', 'outline']);
    expect(button.html).toContain('data-nv-link="url"');

    const image = await getBlock('nv-image');
    expect(image.category).toBe('media');
    expect(image.html).toContain('data-nv-image="url"');
    expect(image.html).toContain('data-nv-alt="alt"');

    // nv-video carries the engine hook, never a raw iframe (spec 12).
    const video = await getBlock('nv-video');
    expect(video.category).toBe('media');
    expect(video.html).toContain('data-nv-embed="url"');
    expect(video.html).not.toContain('<iframe');

    const html = await getBlock('nv-html');
    expect(html.category).toBe('advanced');
    expect(html.description).toMatch(/care|trust/i);

    const spacer = await getBlock('nv-spacer');
    expect(spacer.propsSchema.properties?.size?.enum).toEqual(['sm', 'md', 'lg']);

    const separator = await getBlock('nv-separator');
    expect(separator.html).toContain('<hr');
  });

  it('uses style book tokens with fallbacks in the css', async () => {
    const heading = await getBlock('nv-heading');
    expect(heading.css).toContain('var(--nv-color-text, #1a1917)');
    const button = await getBlock('nv-button');
    expect(button.css).toContain('var(--nv-color-primary, #cc3d47)');
  });

  it('does not duplicate native blocks when the app boots a second time', async () => {
    const secondApp = await createTestApp(testDb.connectionUri);
    await secondApp.close();

    const rows = await testDb.db
      .select()
      .from(blocks)
      .where(inArray(blocks.externalReferenceCode, [...NATIVE_BLOCK_ERCS]));
    expect(rows).toHaveLength(NATIVE_BLOCK_ERCS.length);
  });
});
