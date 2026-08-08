import { foreignKey, jsonb, pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { envelopeColumns, statusColumn } from './envelope';
import { tenants } from './tenants';

export interface BlockSlot {
  name: string;
  allowedBlocks?: string[];
}

export const blocks = pgTable(
  'blocks',
  {
    ...envelopeColumns,
    ...statusColumn,
    name: varchar('name', { length: 255 }).notNull(),
    category: varchar('category', { length: 100 }),
    description: text('description'),
    propsSchema: jsonb('props_schema').$type<Record<string, unknown>>().notNull(),
    slots: jsonb('slots').$type<BlockSlot[]>().notNull().default([]),
  },
  (t) => [
    uniqueIndex('blocks_tenant_erc_uq').on(t.tenantId, t.externalReferenceCode),
    foreignKey({ columns: [t.tenantId], foreignColumns: [tenants.id], name: 'blocks_tenant_fk' }),
  ],
);
