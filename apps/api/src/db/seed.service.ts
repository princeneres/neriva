import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import * as argon2 from 'argon2';
import { and, eq } from 'drizzle-orm';
import { DB, type Database } from './database';
import { roles, tenants, userRoles, users } from './schema';

export const DEFAULT_TENANT_ERC = 'default';
export const ADMIN_ROLE_ERC = 'administrator';
export const ADMIN_EMAIL = 'admin@neriva.com';
export const ADMIN_INITIAL_PASSWORD = 'admin';

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

      let adminUser = (
        await tx
          .select()
          .from(users)
          .where(and(eq(users.tenantId, tenant.id), eq(users.email, ADMIN_EMAIL)))
          .limit(1)
      )[0];
      if (!adminUser) {
        const passwordHash = await argon2.hash(ADMIN_INITIAL_PASSWORD);
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
