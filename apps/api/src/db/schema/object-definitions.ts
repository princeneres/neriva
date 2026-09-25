import {
  foreignKey,
  index,
  jsonb,
  pgEnum,
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

// Anonymous access ladder (spec 05). A single ordered enum instead of two
// booleans: "write without read" is not a state anyone wants, and an enum
// makes the default ('none') the only value a migration can hand to rows that
// were never reviewed.
export const OBJECT_PUBLIC_ACCESS_MODES = ['none', 'read', 'read-write'] as const;
export type ObjectPublicAccess = (typeof OBJECT_PUBLIC_ACCESS_MODES)[number];

export const objectPublicAccess = pgEnum('object_public_access', OBJECT_PUBLIC_ACCESS_MODES);

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
    // Fail closed: every definition is private until someone opts it in.
    publicAccess: objectPublicAccess('public_access').notNull().default('none'),
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
