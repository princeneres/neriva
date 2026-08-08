import { foreignKey, index, jsonb, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { envelopeColumns } from './envelope';
import { objectDefinitions } from './object-definitions';
import { tenants } from './tenants';

export const objectRecords = pgTable(
  'object_records',
  {
    ...envelopeColumns,
    // restrict: deleting a definition that still has records must fail
    // (surfaced as 409 by the objects module).
    objectDefinitionId: uuid('object_definition_id')
      .notNull()
      .references(() => objectDefinitions.id, { onDelete: 'restrict' }),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
  },
  (t) => [
    uniqueIndex('object_records_tenant_erc_uq').on(t.tenantId, t.externalReferenceCode),
    index('object_records_tenant_definition_idx').on(t.tenantId, t.objectDefinitionId),
    foreignKey({
      columns: [t.tenantId],
      foreignColumns: [tenants.id],
      name: 'object_records_tenant_fk',
    }),
  ],
);
