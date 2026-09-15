import { foreignKey, pgEnum, pgTable, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { envelopeColumns } from './envelope';
import { tenants } from './tenants';

export const RESOURCE_FOLDER_RESOURCES = [
  'blocks',
  'content-types',
  'content-entries',
  'objects',
] as const;
export type ResourceFolderResource = (typeof RESOURCE_FOLDER_RESOURCES)[number];

export const resourceFolderResource = pgEnum('resource_folder_resource', RESOURCE_FOLDER_RESOURCES);

export const resourceFolders = pgTable(
  'resource_folders',
  {
    ...envelopeColumns,
    name: varchar('name', { length: 255 }).notNull(),
    resource: resourceFolderResource('resource').notNull(),
  },
  (t) => [
    uniqueIndex('resource_folders_tenant_erc_uq').on(t.tenantId, t.externalReferenceCode),
    uniqueIndex('resource_folders_tenant_resource_name_uq').on(t.tenantId, t.resource, t.name),
    foreignKey({
      columns: [t.tenantId],
      foreignColumns: [tenants.id],
      name: 'resource_folders_tenant_fk',
    }),
  ],
);
