import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { and, eq, inArray } from 'drizzle-orm';
import { isUniqueViolation } from '../../common/pg-errors';
import { DB, type Database } from '../../db/database';
import { roles, userRoles, users } from '../../db/schema';
import { TenantScopedRepository, type CursorPage } from '../../db/tenant-scoped.repository';
import { toPublicUser, type PublicUser } from '../auth/auth.types';

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private repo(tenantId: string): TenantScopedRepository<typeof users> {
    return new TenantScopedRepository(this.db, users, tenantId);
  }

  async list(
    tenantId: string,
    params: { limit?: number; cursor?: string },
  ): Promise<CursorPage<PublicUser>> {
    const page = await this.repo(tenantId).list(params);
    return { ...page, items: page.items.map(toPublicUser) };
  }

  async getById(tenantId: string, id: string): Promise<PublicUser> {
    const user = await this.repo(tenantId).findById(id);
    if (!user) {
      throw new NotFoundException({ detail: `User ${id} not found` });
    }
    return toPublicUser(user);
  }

  async create(
    tenantId: string,
    createdBy: string,
    input: {
      email: string;
      displayName: string;
      password: string;
      externalReferenceCode?: string;
      roleIds?: string[];
    },
  ): Promise<PublicUser> {
    if (input.roleIds?.length) {
      await this.assertRolesExist(tenantId, input.roleIds);
    }

    const passwordHash = await argon2.hash(input.password);
    try {
      // Intermediate variable: tsc cannot apply the excess-property check to
      // the generic repository parameter and rejects fresh literals here.
      const values = {
        email: input.email,
        displayName: input.displayName,
        passwordHash,
        // Admin-created accounts start with a temporary password.
        mustChangePassword: true,
        createdBy,
        // undefined lets the envelope default generate one
        externalReferenceCode: input.externalReferenceCode,
      };
      const user = await this.repo(tenantId).create(values);
      if (input.roleIds?.length) {
        await this.db
          .insert(userRoles)
          .values(input.roleIds.map((roleId) => ({ userId: user.id, roleId, tenantId })))
          .onConflictDoNothing();
      }
      return toPublicUser(user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ detail: 'A user with this email or ERC already exists' });
      }
      throw error;
    }
  }

  async update(
    tenantId: string,
    id: string,
    input: { email?: string; displayName?: string },
  ): Promise<PublicUser> {
    try {
      const updated = await this.repo(tenantId).updateById(id, input);
      if (!updated) {
        throw new NotFoundException({ detail: `User ${id} not found` });
      }
      return toPublicUser(updated);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ detail: 'A user with this email already exists' });
      }
      throw error;
    }
  }

  async delete(tenantId: string, id: string): Promise<void> {
    const deleted = await this.repo(tenantId).deleteById(id);
    if (!deleted) {
      throw new NotFoundException({ detail: `User ${id} not found` });
    }
  }

  async assignRole(tenantId: string, userId: string, roleId: string): Promise<void> {
    await this.getById(tenantId, userId);
    await this.assertRolesExist(tenantId, [roleId]);
    await this.db.insert(userRoles).values({ userId, roleId, tenantId }).onConflictDoNothing();
  }

  async unassignRole(tenantId: string, userId: string, roleId: string): Promise<void> {
    await this.db
      .delete(userRoles)
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.roleId, roleId),
          eq(userRoles.tenantId, tenantId),
        ),
      );
  }

  private async assertRolesExist(tenantId: string, roleIds: string[]): Promise<void> {
    const found = await this.db
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.tenantId, tenantId), inArray(roles.id, roleIds)));
    if (found.length !== roleIds.length) {
      throw new NotFoundException({ detail: 'One or more roles were not found' });
    }
  }
}
