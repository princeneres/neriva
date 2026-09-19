import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import type { CursorPage } from '../../db/tenant-scoped.repository';
import { DB, type Database } from '../../db/database';
import { rolePermissions, roles } from '../../db/schema';
import { TenantScopedRepository } from '../../db/tenant-scoped.repository';
import { isUniqueViolation } from '../../common/pg-errors';
import type { PermissionDto } from './dto/roles.dto';

export type RoleRow = InferSelectModel<typeof roles>;
export interface RoleWithPermissions extends RoleRow {
  permissions: { resourceType: string; action: string }[];
}

@Injectable()
export class RolesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private repo(tenantId: string): TenantScopedRepository<typeof roles> {
    return new TenantScopedRepository(this.db, roles, tenantId);
  }

  async list(
    tenantId: string,
    params: { limit?: number; cursor?: string },
  ): Promise<CursorPage<RoleWithPermissions>> {
    const page = await this.repo(tenantId).list(params);
    const withPermissions = await this.attachPermissions(page.items);
    return { ...page, items: withPermissions };
  }

  async getByRef(tenantId: string, ref: string): Promise<RoleWithPermissions> {
    const role = await this.repo(tenantId).findByRef(ref);
    if (!role) {
      throw new NotFoundException({ detail: `Role ${ref} not found` });
    }
    return (await this.attachPermissions([role]))[0]!;
  }

  async create(
    tenantId: string,
    createdBy: string,
    input: {
      name: string;
      description?: string;
      externalReferenceCode?: string;
      permissions?: PermissionDto[];
    },
  ): Promise<RoleWithPermissions> {
    const permissions = dedupePermissions(input.permissions ?? []);
    try {
      // Single transaction: a failure inserting permissions must not leave
      // an orphaned role behind.
      const roleId = await this.db.transaction(async (tx) => {
        const [role] = await tx
          .insert(roles)
          .values({
            tenantId,
            name: input.name,
            description: input.description ?? null,
            createdBy,
            // undefined lets the envelope default generate one
            externalReferenceCode: input.externalReferenceCode,
          })
          .returning({ id: roles.id });
        if (!role) {
          throw new Error('Role insert returned no row');
        }
        if (permissions.length > 0) {
          await tx.insert(rolePermissions).values(
            permissions.map((p) => ({
              roleId: role.id,
              tenantId,
              resourceType: p.resourceType,
              action: p.action,
            })),
          );
        }
        return role.id;
      });
      return this.getByRef(tenantId, roleId);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ detail: 'A role with this name or ERC already exists' });
      }
      throw error;
    }
  }

  async update(
    tenantId: string,
    ref: string,
    input: { name?: string; description?: string; permissions?: PermissionDto[] },
  ): Promise<RoleWithPermissions> {
    const existing = await this.getByRef(tenantId, ref);
    const values: Partial<{ name: string; description: string | null }> = {};
    if (input.name !== undefined) {
      values.name = input.name;
    }
    if (input.description !== undefined) {
      values.description = input.description;
    }

    try {
      if (input.permissions !== undefined) {
        const permissions = dedupePermissions(input.permissions);
        await this.db.transaction(async (tx) => {
          if (Object.keys(values).length > 0) {
            await tx
              .update(roles)
              .set({ ...values, updatedAt: new Date() })
              .where(and(eq(roles.tenantId, tenantId), eq(roles.id, existing.id)));
          }
          await tx
            .delete(rolePermissions)
            .where(
              and(eq(rolePermissions.roleId, existing.id), eq(rolePermissions.tenantId, tenantId)),
            );
          if (permissions.length > 0) {
            await tx.insert(rolePermissions).values(
              permissions.map((p) => ({
                roleId: existing.id,
                tenantId,
                resourceType: p.resourceType,
                action: p.action,
              })),
            );
          }
        });
      } else if (Object.keys(values).length > 0) {
        await this.repo(tenantId).updateById(existing.id, values);
      }
      return this.getByRef(tenantId, existing.id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ detail: 'A role with this name already exists' });
      }
      throw error;
    }
  }

  async delete(tenantId: string, ref: string): Promise<void> {
    const existing = await this.getByRef(tenantId, ref);
    await this.repo(tenantId).deleteById(existing.id);
  }

  private async replacePermissions(
    tenantId: string,
    roleId: string,
    input: PermissionDto[],
  ): Promise<void> {
    const permissions = dedupePermissions(input);
    await this.db.transaction(async (tx) => {
      await tx
        .delete(rolePermissions)
        .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.tenantId, tenantId)));
      if (permissions.length > 0) {
        await tx.insert(rolePermissions).values(
          permissions.map((p) => ({
            roleId,
            tenantId,
            resourceType: p.resourceType,
            action: p.action,
          })),
        );
      }
    });
  }

  private async attachPermissions(items: RoleRow[]): Promise<RoleWithPermissions[]> {
    if (items.length === 0) {
      return [];
    }
    const grants = await this.db
      .select()
      .from(rolePermissions)
      .where(
        inArray(
          rolePermissions.roleId,
          items.map((r) => r.id),
        ),
      );
    return items.map((role) => ({
      ...role,
      permissions: grants
        .filter((g) => g.roleId === role.id)
        .map((g) => ({ resourceType: g.resourceType, action: g.action })),
    }));
  }
}

// Repeated (resourceType, action) pairs in a payload would trip the unique
// index and surface as a misleading conflict; collapse them instead.
function dedupePermissions(permissions: PermissionDto[]): PermissionDto[] {
  const seen = new Map<string, PermissionDto>();
  for (const permission of permissions) {
    seen.set(`${permission.resourceType}:${permission.action}`, permission);
  }
  return [...seen.values()];
}
