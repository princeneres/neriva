import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, gt, type InferSelectModel, type SQL } from 'drizzle-orm';
import { clampLimit, decodeCursor, encodeCursor } from '../../common/pagination';
import { isUniqueViolation } from '../../common/pg-errors';
import { expectedUpdatedAt, staleResource } from '../../common/optimistic-concurrency';
import { DB, type Database } from '../../db/database';
import { contentEntries } from '../../db/schema';
import { TenantScopedRepository, type CursorPage } from '../../db/tenant-scoped.repository';
import { SitesService } from '../sites/sites.service';
import { ResourceFoldersService } from '../resource-folders/resource-folders.service';
import { validateEntryValues } from './content-field.validation';
import { ContentTypesService } from './content-types.service';

export type ContentEntryRow = InferSelectModel<typeof contentEntries>;

@Injectable()
export class ContentEntriesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly contentTypesService: ContentTypesService,
    private readonly sitesService: SitesService,
    private readonly foldersService: ResourceFoldersService,
  ) {}

  private repo(tenantId: string): TenantScopedRepository<typeof contentEntries> {
    return new TenantScopedRepository(this.db, contentEntries, tenantId);
  }

  async list(
    tenantId: string,
    params: {
      limit?: number;
      cursor?: string;
      contentType?: string;
      site?: string;
      folder?: string;
    },
  ): Promise<CursorPage<ContentEntryRow>> {
    if (
      params.contentType === undefined &&
      params.site === undefined &&
      params.folder === undefined
    ) {
      return this.repo(tenantId).list(params);
    }
    // The generic repository has no extra-filter support; this mirrors its
    // pagination logic with the tenant filter applied explicitly. Filter
    // refs are resolved first, so an unknown reference is a 404.
    const conditions: (SQL | undefined)[] = [eq(contentEntries.tenantId, tenantId)];
    if (params.contentType !== undefined) {
      const contentType = await this.contentTypesService.getByRef(tenantId, params.contentType);
      conditions.push(eq(contentEntries.contentTypeId, contentType.id));
    }
    if (params.site !== undefined) {
      const site = await this.sitesService.getByRef(tenantId, params.site);
      conditions.push(eq(contentEntries.siteId, site.id));
    }
    if (params.folder !== undefined) {
      const folder = await this.foldersService.assertForResource(
        tenantId,
        params.folder,
        'content-entries',
      );
      conditions.push(eq(contentEntries.folderId, folder.id));
    }
    if (params.cursor !== undefined) {
      conditions.push(gt(contentEntries.id, decodeCursor(params.cursor).id));
    }
    const limit = clampLimit(params.limit);
    const rows = await this.db
      .select()
      .from(contentEntries)
      .where(and(...conditions))
      .orderBy(asc(contentEntries.id))
      .limit(limit + 1);
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    const nextCursor = rows.length > limit && last ? encodeCursor(last.id) : null;
    return { items, nextCursor, limit };
  }

  async getByRef(tenantId: string, ref: string): Promise<ContentEntryRow> {
    const entry = await this.repo(tenantId).findByRef(ref);
    if (!entry) {
      throw new NotFoundException({ detail: `Content entry ${ref} not found` });
    }
    return entry;
  }

  async create(
    tenantId: string,
    createdBy: string,
    input: {
      contentType: string;
      site?: string;
      title: string;
      values: Record<string, unknown>;
      externalReferenceCode?: string;
      folderId?: string | null;
    },
  ): Promise<ContentEntryRow> {
    const contentType = await this.contentTypesService.getByRef(tenantId, input.contentType);
    const folder = input.folderId
      ? await this.foldersService.assertForResource(tenantId, input.folderId, 'content-entries')
      : null;
    const site =
      input.site !== undefined ? await this.sitesService.getByRef(tenantId, input.site) : null;
    validateEntryValues(contentType.fields, input.values);
    try {
      // Intermediate variable: tsc cannot apply the excess-property check to
      // the generic repository parameter and rejects fresh literals here.
      const values = {
        contentTypeId: contentType.id,
        siteId: site?.id ?? null,
        title: input.title,
        values: input.values,
        createdBy,
        // undefined lets the envelope default generate one
        externalReferenceCode: input.externalReferenceCode,
        folderId: folder?.id ?? null,
      };
      return await this.repo(tenantId).create(values);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ detail: 'A content entry with this ERC already exists' });
      }
      throw error;
    }
  }

  async update(
    tenantId: string,
    ref: string,
    input: {
      title?: string;
      values?: Record<string, unknown>;
      site?: string | null;
      expectedUpdatedAt?: string;
      folderId?: string | null;
    },
  ): Promise<ContentEntryRow> {
    const existing = await this.getByRef(tenantId, ref);
    const folder = input.folderId
      ? await this.foldersService.assertForResource(tenantId, input.folderId, 'content-entries')
      : null;
    const values: Partial<{
      title: string;
      values: Record<string, unknown>;
      siteId: string | null;
      folderId: string | null;
    }> = {};
    if (input.title !== undefined) {
      values.title = input.title;
    }
    if (input.values !== undefined) {
      const contentType = await this.contentTypesService.getByRef(tenantId, existing.contentTypeId);
      validateEntryValues(contentType.fields, input.values);
      values.values = input.values;
    }
    if (input.site !== undefined) {
      // null detaches the entry to tenant-wide.
      values.siteId =
        input.site === null ? null : (await this.sitesService.getByRef(tenantId, input.site)).id;
    }
    if (input.folderId !== undefined) values.folderId = folder?.id ?? null;
    if (Object.keys(values).length === 0) {
      return existing;
    }
    const expected = expectedUpdatedAt(input.expectedUpdatedAt);
    const updated = expected
      ? await this.repo(tenantId).updateByIdIfUnmodified(existing.id, expected, values)
      : await this.repo(tenantId).updateById(existing.id, values);
    if (expected && !updated) {
      throw staleResource('Content entry');
    }
    return updated ?? existing;
  }

  async delete(tenantId: string, ref: string): Promise<void> {
    const existing = await this.getByRef(tenantId, ref);
    await this.repo(tenantId).deleteById(existing.id);
  }

  async publish(tenantId: string, ref: string): Promise<ContentEntryRow> {
    const existing = await this.getByRef(tenantId, ref);
    // Direct scoped update: the generic repository cannot type a
    // status-only patch (optional insert keys are lost through the generic).
    const rows = await this.db
      .update(contentEntries)
      .set({ status: 'PUBLISHED', updatedAt: new Date() })
      .where(and(eq(contentEntries.tenantId, tenantId), eq(contentEntries.id, existing.id)))
      .returning();
    return rows[0] ?? existing;
  }
}
