import { boolean, foreignKey, pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { customFieldsColumn, envelopeColumns } from './envelope';
import { tenants } from './tenants';

export const users = pgTable(
  'users',
  {
    ...envelopeColumns,
    email: varchar('email', { length: 320 }).notNull(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    mustChangePassword: boolean('must_change_password').notNull().default(false),
    ...customFieldsColumn,
  },
  (t) => [
    uniqueIndex('users_tenant_erc_uq').on(t.tenantId, t.externalReferenceCode),
    uniqueIndex('users_tenant_email_uq').on(t.tenantId, t.email),
    foreignKey({ columns: [t.tenantId], foreignColumns: [tenants.id], name: 'users_tenant_fk' }),
  ],
);
