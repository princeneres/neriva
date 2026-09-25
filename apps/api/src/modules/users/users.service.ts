import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { and, asc, eq, gt, inArray } from 'drizzle-orm';
import { clampLimit, decodeCursor, encodeCursor } from '../../common/pagination';
import { normalizeSearchTerm, trigramSearch } from '../../common/search';
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

  // Accounts can reach the thousands in a large deploy, and a display name is
  // exactly the short, accented, often mistyped string trigram search is for
  // (users_search_idx).
  async list(
    tenantId: string,
    params: { limit?: number; cursor?: string; search?: string },
  ): Promise<CursorPage<PublicUser>> {
    const search = normalizeSearchTerm(params.search);
    if (search === undefined) {
      const page = await this.repo(tenantId).list(params);
      return { ...page, items: page.items.map(toPublicUser) };
    }
    // The generic repository has no extra-filter support; this mirrors its
    // pagination logic with the tenant filter applied explicitly.
    const limit = clampLimit(params.limit);
    const rows = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          trigramSearch(search, [users.displayName, users.email]),
          params.cursor ? gt(users.id, decodeCursor(params.cursor).id) : undefined,
        ),
      )
      .orderBy(asc(users.id))
      .limit(limit + 1);
    const window = rows.slice(0, limit);
    const last = window[window.length - 1];
    return {
      items: window.map(toPublicUser),
      nextCursor: rows.length > limit && last ? encodeCursor(last.id) : null,
      limit,
    };
  }

  async getByRef(tenantId: string, ref: string): Promise<PublicUser> {
    const user = await this.repo(tenantId).findByRef(ref);
    if (!user) {
      throw new NotFoundException({ detail: `User ${ref} not found` });
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
      // Single transaction: a failure assigning roles must not leave a
      // half-provisioned account behind.
      const user = await this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(users)
          .values({
            tenantId,
            email: input.email,
            displayName: input.displayName,
            passwordHash,
            // Admin-created accounts start with a temporary password.
            mustChangePassword: true,
            createdBy,
            // undefined lets the envelope default generate one
            externalReferenceCode: input.externalReferenceCode,
          })
          .returning();
        if (!created) {
          throw new Error('User insert returned no row');
        }
        if (input.roleIds?.length) {
          await tx
            .insert(userRoles)
            .values(input.roleIds.map((roleId) => ({ userId: created.id, roleId, tenantId })))
            .onConflictDoNothing();
        }
        return created;
      });
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
    ref: string,
    input: { email?: string; displayName?: string },
  ): Promise<PublicUser> {
    const existing = await this.getByRef(tenantId, ref);
    try {
      const updated = await this.repo(tenantId).updateById(existing.id, input);
      if (!updated) {
        throw new NotFoundException({ detail: `User ${ref} not found` });
      }
      return toPublicUser(updated);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ detail: 'A user with this email already exists' });
      }
      throw error;
    }
  }

  async delete(tenantId: string, ref: string): Promise<void> {
    const existing = await this.getByRef(tenantId, ref);
    await this.repo(tenantId).deleteById(existing.id);
  }

  async assignRole(tenantId: string, userRef: string, roleId: string): Promise<void> {
    const user = await this.getByRef(tenantId, userRef);
    await this.assertRolesExist(tenantId, [roleId]);
    await this.db
      .insert(userRoles)
      .values({ userId: user.id, roleId, tenantId })
      .onConflictDoNothing();
  }

  async unassignRole(tenantId: string, userRef: string, roleRef: string): Promise<void> {
    const user = await this.getByRef(tenantId, userRef);
    // Resolve the role like every other URL id (UUID or erc:), instead of
    // feeding the raw segment into a uuid column comparison.
    const role = await new TenantScopedRepository(this.db, roles, tenantId).findByRef(roleRef);
    if (!role) {
      throw new NotFoundException({ detail: `Role ${roleRef} not found` });
    }
    await this.db
      .delete(userRoles)
      .where(
        and(
          eq(userRoles.userId, user.id),
          eq(userRoles.roleId, role.id),
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
