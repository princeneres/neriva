import { foreignKey, jsonb, pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { envelopeColumns } from './envelope';
import { tenants } from './tenants';

export const CONTENT_FIELD_TYPES = ['text', 'richtext', 'number', 'boolean', 'date'] as const;
export type ContentFieldType = (typeof CONTENT_FIELD_TYPES)[number];

// Field definition stored inside content_types.fields (spec 04).
export interface ContentFieldDefinition {
  key: string;
  label: string;
  type: ContentFieldType;
  required: boolean;
}

export const contentTypes = pgTable(
  'content_types',
  {
    ...envelopeColumns,
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    fields: jsonb('fields').$type<ContentFieldDefinition[]>().notNull(),
  },
  (t) => [
    uniqueIndex('content_types_tenant_erc_uq').on(t.tenantId, t.externalReferenceCode),
    uniqueIndex('content_types_tenant_name_uq').on(t.tenantId, t.name),
    foreignKey({
      columns: [t.tenantId],
      foreignColumns: [tenants.id],
      name: 'content_types_tenant_fk',
    }),
  ],
);
