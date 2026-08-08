import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
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

  async getById(tenantId: string, id: string): Promise<RoleWithPermissions> {
    const role = await this.repo(tenantId).findById(id);
    if (!role) {
      throw new NotFoundException({ detail: `Role ${id} not found` });
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
    try {
      // Intermediate variable: tsc cannot apply the excess-property check to
      // the generic repository parameter and rejects fresh literals here.
      const values = {
        name: input.name,
        description: input.description ?? null,
        createdBy,
        // undefined lets the envelope default generate one
        externalReferenceCode: input.externalReferenceCode,
      };
      const role = await this.repo(tenantId).create(values);
      await this.replacePermissions(tenantId, role.id, input.permissions ?? []);
      return this.getById(tenantId, role.id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ detail: 'A role with this name or ERC already exists' });
      }
      throw error;
    }
  }

  async update(
    tenantId: string,
    id: string,
    input: { name?: string; description?: string; permissions?: PermissionDto[] },
  ): Promise<RoleWithPermissions> {
    const values: Partial<{ name: string; description: string | null }> = {};
    if (input.name !== undefined) {
      values.name = input.name;
    }
    if (input.description !== undefined) {
      values.description = input.description;
    }

    try {
      const updated =
        Object.keys(values).length > 0
          ? await this.repo(tenantId).updateById(id, values)
          : await this.repo(tenantId).findById(id);
      if (!updated) {
        throw new NotFoundException({ detail: `Role ${id} not found` });
      }
      if (input.permissions !== undefined) {
        await this.replacePermissions(tenantId, id, input.permissions);
      }
      return this.getById(tenantId, id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ detail: 'A role with this name already exists' });
      }
      throw error;
    }
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const deleted = await this.repo(tenantId).deleteById(id);
    if (!deleted) {
      throw new NotFoundException({ detail: `Role ${id} not found` });
    }
  }

  private async replacePermissions(
    tenantId: string,
    roleId: string,
    permissions: PermissionDto[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
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
