import { jsonb, pgEnum, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { uuidv7 } from 'uuidv7';

export const entityStatus = pgEnum('entity_status', ['DRAFT', 'PUBLISHED', 'ARCHIVED']);

// Standard entity envelope (CLAUDE.md). Spread these into every enveloped
// table; shared helpers instead of inheritance keep each table definition
// explicit and fully visible at its declaration site.
export const envelopeColumns = {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  externalReferenceCode: varchar('external_reference_code', { length: 255 })
    .notNull()
    .$defaultFn(() => uuidv7()),
  tenantId: uuid('tenant_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
  createdBy: uuid('created_by'),
} as const;

// Only for entities with a publication lifecycle.
export const statusColumn = {
  status: entityStatus('status').notNull().default('DRAFT'),
} as const;

// Only for extensible entities.
export const customFieldsColumn = {
  customFields: jsonb('custom_fields').$type<Record<string, unknown>>().notNull().default({}),
} as const;
