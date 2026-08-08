import {
  foreignKey,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { envelopeColumns } from './envelope';
import { tenants } from './tenants';
import { users } from './users';

export const roles = pgTable(
  'roles',
  {
    ...envelopeColumns,
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
  },
  (t) => [
    uniqueIndex('roles_tenant_erc_uq').on(t.tenantId, t.externalReferenceCode),
    uniqueIndex('roles_tenant_name_uq').on(t.tenantId, t.name),
    foreignKey({ columns: [t.tenantId], foreignColumns: [tenants.id], name: 'roles_tenant_fk' }),
  ],
);

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);
