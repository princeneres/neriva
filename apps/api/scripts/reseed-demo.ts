import { and, eq, inArray } from 'drizzle-orm';
import { unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createDatabase, createPool, type Database } from '../src/db/database';
import {
  DEMO_BLOCK_ERCS,
  DEMO_CONTENT_TYPE_ERC,
  DEMO_MEDIA_FOLDER_ERC,
  DEMO_OBJECT_DEFINITION_ERC,
  DEMO_SITE_ERC,
  DEMO_STYLE_BOOK_ERC,
  DemoSeedService,
} from '../src/db/demo-seed.service';
import { NATIVE_BLOCK_ERCS, NativeBlocksSeedService } from '../src/db/native-blocks-seed.service';
import {
  MASTER_DEFAULT_ERC,
  NativeMasterPageSeedService,
  TEMPLATE_BLANK_ERC,
} from '../src/db/native-master-page-seed.service';
import { DEFAULT_TENANT_ERC } from '../src/db/seed.service';
import {
  blocks,
  contentEntries,
  contentTypes,
  mediaFiles,
  mediaFolders,
  objectDefinitions,
  objectRecords,
  pageTemplates,
  pages,
  sites,
  styleBooks,
  tenants,
} from '../src/db/schema';

// The boot seeds are idempotent by external reference code and never
// retro-update existing rows, so edits to the starter content (native blocks,
// the default master page, the demo site's pages) only ever reach a fresh
// database. This script closes that gap for development: it deletes the rows
// those seeds own and runs them again, so the current code is what you see.
//
// It only ever touches rows the seeds themselves created (the known external
// reference codes below, plus the demo site's own pages and entries). The demo
// site row itself is kept so its id and slug, and anything pointing at them,
// stay valid.

async function resolveTenantId(db: Database): Promise<string> {
  const tenant = (
    await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.externalReferenceCode, DEFAULT_TENANT_ERC))
      .limit(1)
  )[0];
  if (!tenant) {
    throw new Error('Default tenant not found, start the API once before reseeding');
  }
  return tenant.id;
}

async function deleteStoredBytes(storageKey: string): Promise<void> {
  try {
    await unlink(join(resolve(process.env.MEDIA_STORAGE_DIR ?? './uploads'), storageKey));
  } catch {
    // Best effort, matches StorageService.delete: a missing file is fine here.
  }
}

async function deleteSeededContent(db: Database, tenantId: string): Promise<void> {
  const site = (
    await db
      .select({ id: sites.id })
      .from(sites)
      .where(and(eq(sites.tenantId, tenantId), eq(sites.externalReferenceCode, DEMO_SITE_ERC)))
      .limit(1)
  )[0];
  if (site) {
    await db.delete(pages).where(and(eq(pages.tenantId, tenantId), eq(pages.siteId, site.id)));
    await db
      .delete(contentEntries)
      .where(and(eq(contentEntries.tenantId, tenantId), eq(contentEntries.siteId, site.id)));
    console.log(`Deleted the pages and content entries of site "${DEMO_SITE_ERC}"`);
  }

  const articleType = (
    await db
      .select({ id: contentTypes.id })
      .from(contentTypes)
      .where(
        and(
          eq(contentTypes.tenantId, tenantId),
          eq(contentTypes.externalReferenceCode, DEMO_CONTENT_TYPE_ERC),
        ),
      )
      .limit(1)
  )[0];
  if (articleType) {
    // Entries of this type that were never attached to the demo site would
    // otherwise hold the type back through its foreign key.
    await db
      .delete(contentEntries)
      .where(
        and(
          eq(contentEntries.tenantId, tenantId),
          eq(contentEntries.contentTypeId, articleType.id),
        ),
      );
    await db.delete(contentTypes).where(eq(contentTypes.id, articleType.id));
    console.log(`Deleted content type "${DEMO_CONTENT_TYPE_ERC}" and its entries`);
  }

  const objectDefinition = (
    await db
      .select({ id: objectDefinitions.id })
      .from(objectDefinitions)
      .where(
        and(
          eq(objectDefinitions.tenantId, tenantId),
          eq(objectDefinitions.externalReferenceCode, DEMO_OBJECT_DEFINITION_ERC),
        ),
      )
      .limit(1)
  )[0];
  if (objectDefinition) {
    await db
      .delete(objectRecords)
      .where(
        and(
          eq(objectRecords.tenantId, tenantId),
          eq(objectRecords.objectDefinitionId, objectDefinition.id),
        ),
      );
    await db.delete(objectDefinitions).where(eq(objectDefinitions.id, objectDefinition.id));
    console.log(`Deleted object definition "${DEMO_OBJECT_DEFINITION_ERC}" and its records`);
  }

  const folder = (
    await db
      .select({ id: mediaFolders.id })
      .from(mediaFolders)
      .where(
        and(
          eq(mediaFolders.tenantId, tenantId),
          eq(mediaFolders.externalReferenceCode, DEMO_MEDIA_FOLDER_ERC),
        ),
      )
      .limit(1)
  )[0];
  if (folder) {
    const files = await db
      .select({ id: mediaFiles.id, storageKey: mediaFiles.storageKey })
      .from(mediaFiles)
      .where(and(eq(mediaFiles.tenantId, tenantId), eq(mediaFiles.folderId, folder.id)));
    for (const file of files) {
      await deleteStoredBytes(file.storageKey);
    }
    await db
      .delete(mediaFiles)
      .where(and(eq(mediaFiles.tenantId, tenantId), eq(mediaFiles.folderId, folder.id)));
    await db.delete(mediaFolders).where(eq(mediaFolders.id, folder.id));
    console.log(`Deleted media folder "${DEMO_MEDIA_FOLDER_ERC}" and its ${files.length} file(s)`);
  }

  await db
    .delete(pageTemplates)
    .where(
      and(
        eq(pageTemplates.tenantId, tenantId),
        inArray(pageTemplates.externalReferenceCode, [MASTER_DEFAULT_ERC, TEMPLATE_BLANK_ERC]),
      ),
    );
  console.log('Deleted the seeded page templates');

  await db
    .delete(blocks)
    .where(
      and(
        eq(blocks.tenantId, tenantId),
        inArray(blocks.externalReferenceCode, [...NATIVE_BLOCK_ERCS, ...DEMO_BLOCK_ERCS]),
      ),
    );
  console.log('Deleted the seeded blocks');

  await db
    .delete(styleBooks)
    .where(
      and(
        eq(styleBooks.tenantId, tenantId),
        eq(styleBooks.externalReferenceCode, DEMO_STYLE_BOOK_ERC),
      ),
    );
  console.log(`Deleted style book "${DEMO_STYLE_BOOK_ERC}"`);
}

// Run from apps/api: pnpm db:reseed-demo
async function main(): Promise<void> {
  if (process.env.SEED_DEMO === 'false' || process.env.SEED_NATIVE_BLOCKS === 'false') {
    throw new Error(
      'SEED_DEMO or SEED_NATIVE_BLOCKS is false, so the seeds would delete the starter content without recreating it. Unset them and run again.',
    );
  }
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force')) {
    throw new Error('Refusing to reseed with NODE_ENV=production, pass --force if you mean it');
  }
  const pool = createPool(
    process.env.DATABASE_URL ?? 'postgres://neriva:neriva@localhost:5432/neriva',
  );
  const db = createDatabase(pool);
  try {
    const tenantId = await resolveTenantId(db);
    await deleteSeededContent(db, tenantId);
    // Order matters: the master page template is built from the native blocks.
    await new NativeBlocksSeedService(db).run();
    await new NativeMasterPageSeedService(db).run();
    await new DemoSeedService(db).run();
    console.log('Starter content reseeded');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
