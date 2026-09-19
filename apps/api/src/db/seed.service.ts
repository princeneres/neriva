import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import * as argon2 from 'argon2';
import { and, eq } from 'drizzle-orm';
import { DB, type Database } from './database';
import { rolePermissions, roles, tenants, userRoles, users } from './schema';

export const DEFAULT_TENANT_ERC = 'default';
export const ADMIN_ROLE_ERC = 'administrator';
// "Manager" (not "Editor") because the grant covers the full content
// lifecycle, publish included, not just drafting; kept distinct from the
// ad-hoc "Content Editor" role name used in e2e fixtures elsewhere.
export const CONTENT_MANAGER_ROLE_ERC = 'content-manager';
export const ADMIN_EMAIL = 'admin@neriva.com';
export const ADMIN_INITIAL_PASSWORD = 'admin';

export function initialAdminPassword(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.NERIVA_INITIAL_ADMIN_PASSWORD;
  if (env.NODE_ENV === 'production') {
    if (!configured || configured.length < 15) {
      throw new Error(
        'NERIVA_INITIAL_ADMIN_PASSWORD must be set to at least 15 characters in production',
      );
    }
    return configured;
  }
  return configured ?? ADMIN_INITIAL_PASSWORD;
}

// Full CRUD(+publish) on every content-facing resource type; read-only on the
// resources that define schemas/templates for others to use (object
// definitions, block templates); no site/tenant administration.
const CONTENT_MANAGER_PERMISSIONS: ReadonlyArray<{ resourceType: string; action: string }> = [
  { resourceType: 'page', action: 'read' },
  { resourceType: 'page', action: 'create' },
  { resourceType: 'page', action: 'update' },
  { resourceType: 'page', action: 'delete' },
  { resourceType: 'page', action: 'publish' },
  { resourceType: 'content-entry', action: 'read' },
  { resourceType: 'content-entry', action: 'create' },
  { resourceType: 'content-entry', action: 'update' },
  { resourceType: 'content-entry', action: 'delete' },
  { resourceType: 'content-entry', action: 'publish' },
  { resourceType: 'content-type', action: 'read' },
  { resourceType: 'content-type', action: 'create' },
  { resourceType: 'content-type', action: 'update' },
  { resourceType: 'content-type', action: 'delete' },
  { resourceType: 'media', action: 'read' },
  { resourceType: 'media', action: 'create' },
  { resourceType: 'media', action: 'update' },
  { resourceType: 'media', action: 'delete' },
  { resourceType: 'object-record', action: 'read' },
  { resourceType: 'object-record', action: 'create' },
  { resourceType: 'object-record', action: 'update' },
  { resourceType: 'object-record', action: 'delete' },
  { resourceType: 'object-definition', action: 'read' },
  { resourceType: 'block', action: 'read' },
  { resourceType: 'resource-folder', action: 'read' },
  { resourceType: 'resource-folder', action: 'create' },
  { resourceType: 'resource-folder', action: 'update' },
  { resourceType: 'resource-folder', action: 'delete' },
];

// First-boot seed (CLAUDE.md bootstrap rule). Idempotent: existing rows are
// never overwritten, so a changed admin password survives restarts.
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(@Inject(DB) private readonly db: Database) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.run();
  }

  async run(): Promise<void> {
    await this.db.transaction(async (tx) => {
      let tenant = (
        await tx
          .select()
          .from(tenants)
          .where(eq(tenants.externalReferenceCode, DEFAULT_TENANT_ERC))
          .limit(1)
      )[0];
      if (!tenant) {
        [tenant] = await tx
          .insert(tenants)
          .values({ externalReferenceCode: DEFAULT_TENANT_ERC, name: 'Default' })
          .returning();
        this.logger.log('Seeded tenant "default"');
      }
      if (!tenant) {
        throw new Error('Failed to seed default tenant');
      }

      let adminRole = (
        await tx
          .select()
          .from(roles)
          .where(
            and(eq(roles.tenantId, tenant.id), eq(roles.externalReferenceCode, ADMIN_ROLE_ERC)),
          )
          .limit(1)
      )[0];
      if (!adminRole) {
        [adminRole] = await tx
          .insert(roles)
          .values({
            tenantId: tenant.id,
            externalReferenceCode: ADMIN_ROLE_ERC,
            name: 'Administrator',
            description: 'Full access to every resource in the tenant',
          })
          .returning();
        this.logger.log('Seeded role "Administrator"');
      }
      if (!adminRole) {
        throw new Error('Failed to seed Administrator role');
      }

      await tx
        .insert(rolePermissions)
        .values({ roleId: adminRole.id, tenantId: tenant.id, resourceType: '*', action: '*' })
        .onConflictDoNothing();

      let contentManagerRole = (
        await tx
          .select()
          .from(roles)
          .where(
            and(
              eq(roles.tenantId, tenant.id),
              eq(roles.externalReferenceCode, CONTENT_MANAGER_ROLE_ERC),
            ),
          )
          .limit(1)
      )[0];
      if (!contentManagerRole) {
        [contentManagerRole] = await tx
          .insert(roles)
          .values({
            tenantId: tenant.id,
            externalReferenceCode: CONTENT_MANAGER_ROLE_ERC,
            name: 'Content Manager',
            description:
              'Manages pages, content, media and object records end to end, without site or tenant administration',
          })
          .returning();
        this.logger.log('Seeded role "Content Manager"');
      }
      if (!contentManagerRole) {
        throw new Error('Failed to seed Content Manager role');
      }

      await tx
        .insert(rolePermissions)
        .values(
          CONTENT_MANAGER_PERMISSIONS.map((permission) => ({
            roleId: contentManagerRole.id,
            tenantId: tenant.id,
            resourceType: permission.resourceType,
            action: permission.action,
          })),
        )
        .onConflictDoNothing();

      let adminUser = (
        await tx
          .select()
          .from(users)
          .where(and(eq(users.tenantId, tenant.id), eq(users.email, ADMIN_EMAIL)))
          .limit(1)
      )[0];
      if (!adminUser) {
        const passwordHash = await argon2.hash(initialAdminPassword());
        [adminUser] = await tx
          .insert(users)
          .values({
            tenantId: tenant.id,
            externalReferenceCode: 'admin',
            email: ADMIN_EMAIL,
            displayName: 'Administrator',
            passwordHash,
            mustChangePassword: true,
          })
          .returning();
        this.logger.log(`Seeded user ${ADMIN_EMAIL} with mustChangePassword=true`);
      }
      if (!adminUser) {
        throw new Error('Failed to seed admin user');
      }

      await tx
        .insert(userRoles)
        .values({ userId: adminUser.id, roleId: adminRole.id, tenantId: tenant.id })
        .onConflictDoNothing();
    });
  }
}
