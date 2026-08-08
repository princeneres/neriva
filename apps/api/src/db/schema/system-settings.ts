import { foreignKey, jsonb, pgTable, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { envelopeColumns } from './envelope';
import { tenants } from './tenants';

// Reduced envelope (spec 07): no status, no customFields.
export const systemSettings = pgTable(
  'system_settings',
  {
    ...envelopeColumns,
    key: varchar('key', { length: 100 }).notNull(),
    value: jsonb('value').notNull(),
  },
  (t) => [
    uniqueIndex('system_settings_tenant_erc_uq').on(t.tenantId, t.externalReferenceCode),
    uniqueIndex('system_settings_tenant_key_uq').on(t.tenantId, t.key),
    foreignKey({
      columns: [t.tenantId],
      foreignColumns: [tenants.id],
      name: 'system_settings_tenant_fk',
    }),
  ],
);
