import {
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { envelopeColumns } from './envelope';
import { tenants } from './tenants';
import { resourceFolders } from './resource-folders';

export const OBJECT_FIELD_TYPES = ['text', 'number', 'boolean', 'date', 'picklist'] as const;
export type ObjectFieldType = (typeof OBJECT_FIELD_TYPES)[number];

// Field definition stored inside object_definitions.fields (spec 05).
// `options` is only present for picklist fields.
export interface ObjectFieldDefinition {
  key: string;
  label: string;
  type: ObjectFieldType;
  required: boolean;
  options?: string[];
}

export const objectDefinitions = pgTable(
  'object_definitions',
  {
    ...envelopeColumns,
    name: varchar('name', { length: 255 }).notNull(),
    pluralName: varchar('plural_name', { length: 255 }).notNull(),
    description: text('description'),
    fields: jsonb('fields').$type<ObjectFieldDefinition[]>().notNull(),
    folderId: uuid('folder_id').references(() => resourceFolders.id, { onDelete: 'set null' }),
  },
  (t) => [
    uniqueIndex('object_definitions_tenant_erc_uq').on(t.tenantId, t.externalReferenceCode),
    index('object_definitions_tenant_folder_id_idx').on(t.tenantId, t.folderId, t.id),
    uniqueIndex('object_definitions_tenant_name_uq').on(t.tenantId, t.name),
    foreignKey({
      columns: [t.tenantId],
      foreignColumns: [tenants.id],
      name: 'object_definitions_tenant_fk',
    }),
  ],
);
