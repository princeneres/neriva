import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, gt } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { clampLimit, decodeCursor, encodeCursor } from '../../common/pagination';
import { isForeignKeyViolation, isUniqueViolation } from '../../common/pg-errors';
import { DB, type Database } from '../../db/database';
import { contentTypes, type ContentFieldDefinition } from '../../db/schema';
import { TenantScopedRepository, type CursorPage } from '../../db/tenant-scoped.repository';
import { normalizeContentTypeFields, type ContentFieldInput } from './content-field.validation';
import { ResourceFoldersService } from '../resource-folders/resource-folders.service';

export type ContentTypeRow = InferSelectModel<typeof contentTypes>;

const DUPLICATE_DETAIL = 'A content type with this name or ERC already exists';

@Injectable()
export class ContentTypesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly foldersService: ResourceFoldersService,
  ) {}

  private repo(tenantId: string): TenantScopedRepository<typeof contentTypes> {
    return new TenantScopedRepository(this.db, contentTypes, tenantId);
  }

  async list(
    tenantId: string,
    params: { limit?: number; cursor?: string; folder?: string },
  ): Promise<CursorPage<ContentTypeRow>> {
    if (!params.folder) return this.repo(tenantId).list(params);
    const folder = await this.foldersService.assertForResource(
      tenantId,
      params.folder,
      'content-types',
    );
    const limit = clampLimit(params.limit);
    const rows = await this.db
      .select()
      .from(contentTypes)
      .where(
        and(
          eq(contentTypes.tenantId, tenantId),
          eq(contentTypes.folderId, folder.id),
          params.cursor ? gt(contentTypes.id, decodeCursor(params.cursor).id) : undefined,
        ),
      )
      .orderBy(asc(contentTypes.id))
      .limit(limit + 1);
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: rows.length > limit && last ? encodeCursor(last.id) : null,
      limit,
    };
  }

  async getByRef(tenantId: string, ref: string): Promise<ContentTypeRow> {
    const contentType = await this.repo(tenantId).findByRef(ref);
    if (!contentType) {
      throw new NotFoundException({ detail: `Content type ${ref} not found` });
    }
    return contentType;
  }

  async create(
    tenantId: string,
    createdBy: string,
    input: {
      name: string;
      description?: string;
      externalReferenceCode?: string;
      fields: ContentFieldInput[];
      folderId?: string | null;
    },
  ): Promise<ContentTypeRow> {
    const fields = normalizeContentTypeFields(input.fields);
    try {
      // Intermediate variable: tsc cannot apply the excess-property check to
      // the generic repository parameter and rejects fresh literals here.
      const folder = input.folderId
        ? await this.foldersService.assertForResource(tenantId, input.folderId, 'content-types')
        : null;
      const values = {
        name: input.name,
        description: input.description ?? null,
        fields,
        createdBy,
        // undefined lets the envelope default generate one
        externalReferenceCode: input.externalReferenceCode,
        folderId: folder?.id ?? null,
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
    input: {
      name?: string;
      description?: string;
      fields?: ContentFieldInput[];
      folderId?: string | null;
    },
  ): Promise<ContentTypeRow> {
    const existing = await this.getByRef(tenantId, ref);
    const folder = input.folderId
      ? await this.foldersService.assertForResource(tenantId, input.folderId, 'content-types')
      : null;
    const values: Partial<{
      name: string;
      description: string | null;
      fields: ContentFieldDefinition[];
      folderId: string | null;
    }> = {};
    if (input.name !== undefined) {
      values.name = input.name;
    }
    if (input.description !== undefined) {
      values.description = input.description;
    }
    if (input.fields !== undefined) {
      // Changing fields does not retro-validate existing entries
      // (documented limitation, spec 04).
      values.fields = normalizeContentTypeFields(input.fields);
    }
    if (input.folderId !== undefined) values.folderId = folder?.id ?? null;
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
    try {
      await this.repo(tenantId).deleteById(existing.id);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException({
          detail: 'Content type still has entries and cannot be deleted',
        });
      }
      throw error;
    }
  }
}
