import { foreignKey, integer, jsonb, pgTable, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { envelopeColumns, statusColumn } from './envelope';
import { tenants } from './tenants';

export const styleBooks = pgTable(
  'style_books',
  {
    ...envelopeColumns,
    ...statusColumn,
    name: varchar('name', { length: 255 }).notNull(),
    version: integer('version').notNull().default(1),
    tokens: jsonb('tokens').$type<Record<string, string>>().notNull(),
  },
  (t) => [
    uniqueIndex('style_books_tenant_erc_uq').on(t.tenantId, t.externalReferenceCode),
    uniqueIndex('style_books_tenant_name_uq').on(t.tenantId, t.name),
    foreignKey({
      columns: [t.tenantId],
      foreignColumns: [tenants.id],
      name: 'style_books_tenant_fk',
    }),
  ],
);
