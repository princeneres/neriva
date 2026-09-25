import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, gt, type InferSelectModel } from 'drizzle-orm';
import { clampLimit, decodeCursor, encodeCursor } from '../../common/pagination';
import { isUniqueViolation } from '../../common/pg-errors';
import { normalizeSearchTerm, substringSearch } from '../../common/search';
import { DB, type Database } from '../../db/database';
import { sites } from '../../db/schema';
import { TenantScopedRepository, type CursorPage } from '../../db/tenant-scoped.repository';

export type SiteRow = InferSelectModel<typeof sites>;

const DUPLICATE_DETAIL = 'A site with this slug or ERC already exists';

@Injectable()
export class SitesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private repo(tenantId: string): TenantScopedRepository<typeof sites> {
    return new TenantScopedRepository(this.db, sites, tenantId);
  }

  // A deploy has a handful of sites, so the search is a plain accent
  // insensitive substring match with no index behind it.
  async list(
    tenantId: string,
    params: { limit?: number; cursor?: string; search?: string },
  ): Promise<CursorPage<SiteRow>> {
    const search = normalizeSearchTerm(params.search);
    if (search === undefined) {
      return this.repo(tenantId).list(params);
    }
    // The generic repository has no extra-filter support; this mirrors its
    // pagination logic with the tenant filter applied explicitly.
    const limit = clampLimit(params.limit);
    const rows = await this.db
      .select()
      .from(sites)
      .where(
        and(
          eq(sites.tenantId, tenantId),
          substringSearch(search, [sites.name, sites.slug, sites.description]),
          params.cursor ? gt(sites.id, decodeCursor(params.cursor).id) : undefined,
        ),
      )
      .orderBy(asc(sites.id))
      .limit(limit + 1);
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    const nextCursor = rows.length > limit && last ? encodeCursor(last.id) : null;
    return { items, nextCursor, limit };
  }

  async getByRef(tenantId: string, ref: string): Promise<SiteRow> {
    const site = await this.repo(tenantId).findByRef(ref);
    if (!site) {
      throw new NotFoundException({ detail: `Site ${ref} not found` });
    }
    return site;
  }

  async create(
    tenantId: string,
    createdBy: string,
    input: {
      name: string;
      slug: string;
      description?: string;
      externalReferenceCode?: string;
    },
  ): Promise<SiteRow> {
    try {
      // Intermediate variable: tsc cannot apply the excess-property check to
      // the generic repository parameter and rejects fresh literals here.
      const values = {
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        createdBy,
        // undefined lets the envelope default generate one
        externalReferenceCode: input.externalReferenceCode,
      };
      return await this.repo(tenantId).create(values);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ detail: DUPLICATE_DETAIL });
      }
      throw error;
    }
  }

  async update(
    tenantId: string,
    ref: string,
    input: { name?: string; slug?: string; description?: string | null },
  ): Promise<SiteRow> {
    const existing = await this.getByRef(tenantId, ref);
    const values: Partial<{ name: string; slug: string; description: string | null }> = {};
    if (input.name !== undefined) {
      values.name = input.name;
    }
    if (input.slug !== undefined) {
      values.slug = input.slug;
    }
    if (input.description !== undefined) {
      values.description = input.description;
    }
    if (Object.keys(values).length === 0) {
      return existing;
    }

    try {
      const updated = await this.repo(tenantId).updateById(existing.id, values);
      return updated ?? existing;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ detail: DUPLICATE_DETAIL });
      }
      throw error;
    }
  }

  async delete(tenantId: string, ref: string): Promise<void> {
    const existing = await this.getByRef(tenantId, ref);
    await this.repo(tenantId).deleteById(existing.id);
  }
}
