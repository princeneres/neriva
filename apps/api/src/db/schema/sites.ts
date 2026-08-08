import { foreignKey, pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { customFieldsColumn, envelopeColumns } from './envelope';
import { tenants } from './tenants';

// Sites are always live, so no status column (spec 01-sites).
export const sites = pgTable(
  'sites',
  {
    ...envelopeColumns,
    ...customFieldsColumn,
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    description: text('description'),
  },
  (t) => [
    uniqueIndex('sites_tenant_erc_uq').on(t.tenantId, t.externalReferenceCode),
    uniqueIndex('sites_tenant_slug_uq').on(t.tenantId, t.slug),
    foreignKey({ columns: [t.tenantId], foreignColumns: [tenants.id], name: 'sites_tenant_fk' }),
  ],
);
