import {
  foreignKey,
  pgTable,
  unique,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { envelopeColumns } from './envelope';
import { sites } from './sites';
import { tenants } from './tenants';

// Folders are always live containers, so no status/customFields (spec 11).
export const mediaFolders = pgTable(
  'media_folders',
  {
    ...envelopeColumns,
    name: varchar('name', { length: 255 }).notNull(),
    // cascade: deleting a folder removes the whole subtree.
    parentId: uuid('parent_id').references((): AnyPgColumn => mediaFolders.id, {
      onDelete: 'cascade',
    }),
    // Non-null marks a site's default folder (spec 11). set null: deleting a
    // site keeps its media folder as a regular folder.
    siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),
  },
  (t) => [
    uniqueIndex('media_folders_tenant_erc_uq').on(t.tenantId, t.externalReferenceCode),
    // NULLS NOT DISTINCT so root-level siblings (parent_id IS NULL) also get
    // unique names.
    unique('media_folders_tenant_parent_name_uq')
      .on(t.tenantId, t.parentId, t.name)
      .nullsNotDistinct(),
    foreignKey({
      columns: [t.tenantId],
      foreignColumns: [tenants.id],
      name: 'media_folders_tenant_fk',
    }),
  ],
);
