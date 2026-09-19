import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, gt } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { clampLimit, decodeCursor, encodeCursor } from '../../common/pagination';
import { isForeignKeyViolation, isUniqueViolation } from '../../common/pg-errors';
import { DB, type Database } from '../../db/database';
import { objectDefinitions, type ObjectFieldDefinition } from '../../db/schema';
import { TenantScopedRepository, type CursorPage } from '../../db/tenant-scoped.repository';
import { validateDefinitionFields } from './object-field.validation';
import { ResourceFoldersService } from '../resource-folders/resource-folders.service';

export type ObjectDefinitionRow = InferSelectModel<typeof objectDefinitions>;

@Injectable()
export class ObjectDefinitionsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly foldersService: ResourceFoldersService,
  ) {}

  private repo(tenantId: string): TenantScopedRepository<typeof objectDefinitions> {
    return new TenantScopedRepository(this.db, objectDefinitions, tenantId);
  }

  async list(
    tenantId: string,
    params: { limit?: number; cursor?: string; folder?: string },
  ): Promise<CursorPage<ObjectDefinitionRow>> {
    if (!params.folder) return this.repo(tenantId).list(params);
    const folder = await this.foldersService.assertForResource(tenantId, params.folder, 'objects');
    const limit = clampLimit(params.limit);
    const rows = await this.db
      .select()
      .from(objectDefinitions)
      .where(
        and(
          eq(objectDefinitions.tenantId, tenantId),
          eq(objectDefinitions.folderId, folder.id),
          params.cursor ? gt(objectDefinitions.id, decodeCursor(params.cursor).id) : undefined,
        ),
      )
      .orderBy(asc(objectDefinitions.id))
      .limit(limit + 1);
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    return {
      items,
      nextCursor: rows.length > limit && last ? encodeCursor(last.id) : null,
      limit,
    };
  }

  async getByRef(tenantId: string, ref: string): Promise<ObjectDefinitionRow> {
    const definition = await this.repo(tenantId).findByRef(ref);
    if (!definition) {
      throw new NotFoundException({ detail: `Object definition ${ref} not found` });
    }
    return definition;
  }

  async create(
    tenantId: string,
    createdBy: string,
    input: {
      name: string;
      pluralName: string;
      description?: string;
      externalReferenceCode?: string;
      fields: ObjectFieldDefinition[];
      folderId?: string | null;
    },
  ): Promise<ObjectDefinitionRow> {
    validateDefinitionFields(input.fields);
    try {
      // Intermediate variable: tsc cannot apply the excess-property check to
      // the generic repository parameter and rejects fresh literals here.
      const folder = input.folderId
        ? await this.foldersService.assertForResource(tenantId, input.folderId, 'objects')
        : null;
      const values = {
        name: input.name,
        pluralName: input.pluralName,
        description: input.description ?? null,
        fields: input.fields,
        createdBy,
        // undefined lets the envelope default generate one
        externalReferenceCode: input.externalReferenceCode,
        folderId: folder?.id ?? null,
      };
      return await this.repo(tenantId).create(values);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          detail: 'An object definition with this name or ERC already exists',
        });
      }
      throw error;
    }
  }

  async update(
    tenantId: string,
    ref: string,
    input: {
      name?: string;
      pluralName?: string;
      description?: string;
      fields?: ObjectFieldDefinition[];
      folderId?: string | null;
    },
  ): Promise<ObjectDefinitionRow> {
    const existing = await this.getByRef(tenantId, ref);
    const folder = input.folderId
      ? await this.foldersService.assertForResource(tenantId, input.folderId, 'objects')
      : null;
    const values: Partial<{
      name: string;
      pluralName: string;
      description: string | null;
      fields: ObjectFieldDefinition[];
      folderId: string | null;
    }> = {};
    if (input.name !== undefined) {
      values.name = input.name;
    }
    if (input.pluralName !== undefined) {
      values.pluralName = input.pluralName;
    }
    if (input.description !== undefined) {
      values.description = input.description;
    }
    if (input.fields !== undefined) {
      validateDefinitionFields(input.fields);
      values.fields = input.fields;
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
        throw new ConflictException({
          detail: 'An object definition with this name already exists',
        });
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
          detail: 'Object definition still has records and cannot be deleted',
        });
      }
      throw error;
    }
  }
}
