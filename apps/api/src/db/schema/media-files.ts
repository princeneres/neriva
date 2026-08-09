import {
  foreignKey,
  index,
  integer,
  pgTable,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { customFieldsColumn, envelopeColumns } from './envelope';
import { mediaFolders } from './media-folders';
import { tenants } from './tenants';

// File metadata only; the bytes live on the filesystem under the storage key
// (spec 11). No status column: uploads are immediately live.
export const mediaFiles = pgTable(
  'media_files',
  {
    ...envelopeColumns,
    ...customFieldsColumn,
    // null = library root. cascade: deleting a folder removes its files.
    folderId: uuid('folder_id').references(() => mediaFolders.id, { onDelete: 'cascade' }),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    contentType: varchar('content_type', { length: 127 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    storageKey: varchar('storage_key', { length: 255 }).notNull().unique(),
    alt: varchar('alt', { length: 500 }),
  },
  (t) => [
    uniqueIndex('media_files_tenant_erc_uq').on(t.tenantId, t.externalReferenceCode),
    index('media_files_tenant_folder_idx').on(t.tenantId, t.folderId),
    foreignKey({
      columns: [t.tenantId],
      foreignColumns: [tenants.id],
      name: 'media_files_tenant_fk',
    }),
  ],
);
