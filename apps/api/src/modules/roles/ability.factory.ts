import { AbilityBuilder, createMongoAbility, type MongoAbility } from '@casl/ability';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DB, type Database } from '../../db/database';
import { rolePermissions, userRoles } from '../../db/schema';

export type AppAbility = MongoAbility<[string, string]>;

// Builds a CASL ability from role_permissions rows. Deny by default: an
// empty grant list means an ability that allows nothing.
@Injectable()
export class AbilityFactory {
  constructor(@Inject(DB) private readonly db: Database) {}

  async createForUser(user: { id: string; tenantId: string }): Promise<AppAbility> {
    const grants = await this.db
      .select({
        action: rolePermissions.action,
        resourceType: rolePermissions.resourceType,
        siteId: rolePermissions.siteId,
      })
      .from(rolePermissions)
      .innerJoin(userRoles, eq(userRoles.roleId, rolePermissions.roleId))
      .where(and(eq(userRoles.userId, user.id), eq(rolePermissions.tenantId, user.tenantId)));

    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    for (const grant of grants) {
      // Site-scoped grants are intentionally fail-closed until the request
      // guard has a resource-aware site context. Treating them as tenant-wide
      // would turn a narrow grant into a privilege escalation.
      if (grant.siteId !== null) {
        continue;
      }
      // '*' wildcards map to CASL's manage/all keywords.
      can(
        grant.action === '*' ? 'manage' : grant.action,
        grant.resourceType === '*' ? 'all' : grant.resourceType,
      );
    }
    return build();
  }
}
