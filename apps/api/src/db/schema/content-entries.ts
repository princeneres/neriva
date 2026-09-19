import { foreignKey, index, jsonb, pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { contentTypes } from './content-types';
import { customFieldsColumn, envelopeColumns, statusColumn } from './envelope';
import { sites } from './sites';
import { tenants } from './tenants';
import { resourceFolders } from './resource-folders';

export const contentEntries = pgTable(
  'content_entries',
  {
    ...envelopeColumns,
    ...statusColumn,
    ...customFieldsColumn,
    // restrict: deleting a content type that still has entries must fail
    // (surfaced as 409 by the content module).
    contentTypeId: uuid('content_type_id')
      .notNull()
      .references(() => contentTypes.id, { onDelete: 'restrict' }),
    // null = tenant-wide entry (spec 04). set null: deleting a site detaches
    // its entries instead of blocking the site delete.
    siteId: uuid('site_id').references(() => sites.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 255 }).notNull(),
    values: jsonb('values').$type<Record<string, unknown>>().notNull(),
    folderId: uuid('folder_id').references(() => resourceFolders.id, { onDelete: 'set null' }),
  },
  (t) => [
    uniqueIndex('content_entries_tenant_erc_uq').on(t.tenantId, t.externalReferenceCode),
    index('content_entries_tenant_type_idx').on(t.tenantId, t.contentTypeId),
    index('content_entries_tenant_site_idx').on(t.tenantId, t.siteId),
    index('content_entries_tenant_folder_id_idx').on(t.tenantId, t.folderId, t.id),
    foreignKey({
      columns: [t.tenantId],
      foreignColumns: [tenants.id],
      name: 'content_entries_tenant_fk',
    }),
  ],
);
