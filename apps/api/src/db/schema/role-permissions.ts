import { pgTable, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { uuidv7 } from 'uuidv7';
import { roles } from './roles';
import { tenants } from './tenants';

// One row per allowed action on a resource type. '*' wildcards both fields
// (Administrator). siteId narrows the grant to one site; null = tenant-wide.
export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    resourceType: varchar('resource_type', { length: 100 }).notNull(),
    action: varchar('action', { length: 50 }).notNull(),
    siteId: uuid('site_id'),
  },
  (t) => [
    // NULLS NOT DISTINCT so tenant-wide grants (siteId null) cannot duplicate.
    unique('role_permissions_grant_uq')
      .on(t.roleId, t.resourceType, t.action, t.siteId)
      .nullsNotDistinct(),
  ],
);
