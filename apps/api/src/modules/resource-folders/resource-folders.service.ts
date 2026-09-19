import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, gt } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { isUniqueViolation } from '../../common/pg-errors';
import { clampLimit, decodeCursor, encodeCursor } from '../../common/pagination';
import { DB, type Database } from '../../db/database';
import { resourceFolders, type ResourceFolderResource } from '../../db/schema';
import { TenantScopedRepository, type CursorPage } from '../../db/tenant-scoped.repository';

export type ResourceFolderRow = InferSelectModel<typeof resourceFolders>;

@Injectable()
export class ResourceFoldersService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private repo(tenantId: string): TenantScopedRepository<typeof resourceFolders> {
    return new TenantScopedRepository(this.db, resourceFolders, tenantId);
  }

  async list(
    tenantId: string,
    params: { limit?: number; cursor?: string; resource?: ResourceFolderResource },
  ): Promise<CursorPage<ResourceFolderRow>> {
    if (!params.resource) return this.repo(tenantId).list(params);
    const limit = clampLimit(params.limit);
    const rows = await this.db
      .select()
      .from(resourceFolders)
      .where(
        and(
          eq(resourceFolders.tenantId, tenantId),
          eq(resourceFolders.resource, params.resource),
          params.cursor ? gt(resourceFolders.id, decodeCursor(params.cursor).id) : undefined,
        ),
      )
      .orderBy(asc(resourceFolders.id))
      .limit(limit + 1);
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: rows.length > limit && last ? encodeCursor(last.id) : null,
      limit,
    };
  }

  async getByRef(tenantId: string, ref: string): Promise<ResourceFolderRow> {
    const folder = await this.repo(tenantId).findByRef(ref);
    if (!folder) throw new NotFoundException({ detail: `Resource folder ${ref} not found` });
    return folder;
  }

  async assertForResource(
    tenantId: string,
    ref: string,
    resource: ResourceFolderResource,
  ): Promise<ResourceFolderRow> {
    const folder = await this.getByRef(tenantId, ref);
    if (folder.resource !== resource) {
      throw new NotFoundException({ detail: `Resource folder ${ref} not found` });
    }
    return folder;
  }

  async create(
    tenantId: string,
    createdBy: string,
    input: { name: string; resource: ResourceFolderResource; externalReferenceCode?: string },
  ): Promise<ResourceFolderRow> {
    try {
      const rows = await this.db
        .insert(resourceFolders)
        .values({
          tenantId,
          name: input.name.trim(),
          resource: input.resource,
          createdBy,
          externalReferenceCode: input.externalReferenceCode,
        })
        .returning();
      if (!rows[0]) throw new Error('Resource folder insert returned no row');
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ detail: 'A folder with this name already exists here' });
      }
      throw error;
    }
  }

  async update(tenantId: string, ref: string, name: string): Promise<ResourceFolderRow> {
    const existing = await this.getByRef(tenantId, ref);
    try {
      return (await this.repo(tenantId).updateById(existing.id, { name: name.trim() })) ?? existing;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ detail: 'A folder with this name already exists here' });
      }
      throw error;
    }
  }

  async delete(tenantId: string, ref: string): Promise<void> {
    const existing = await this.getByRef(tenantId, ref);
    await this.repo(tenantId).deleteById(existing.id);
  }
}
