import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { InferSelectModel } from 'drizzle-orm';
import { isUniqueViolation } from '../../common/pg-errors';
import { DB, type Database } from '../../db/database';
import { contentTypes, type ContentFieldDefinition } from '../../db/schema';
import { TenantScopedRepository, type CursorPage } from '../../db/tenant-scoped.repository';
import { normalizeContentTypeFields, type ContentFieldInput } from './content-field.validation';

export type ContentTypeRow = InferSelectModel<typeof contentTypes>;

const DUPLICATE_DETAIL = 'A content type with this name or ERC already exists';

// Postgres error code for foreign_key_violation. Local to this module:
// only the content type delete path needs it.
const FOREIGN_KEY_VIOLATION = '23503';

function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === FOREIGN_KEY_VIOLATION
  );
}

@Injectable()
export class ContentTypesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private repo(tenantId: string): TenantScopedRepository<typeof contentTypes> {
    return new TenantScopedRepository(this.db, contentTypes, tenantId);
  }

  async list(
    tenantId: string,
    params: { limit?: number; cursor?: string },
  ): Promise<CursorPage<ContentTypeRow>> {
    return this.repo(tenantId).list(params);
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
    },
  ): Promise<ContentTypeRow> {
    const fields = normalizeContentTypeFields(input.fields);
    try {
      // Intermediate variable: tsc cannot apply the excess-property check to
      // the generic repository parameter and rejects fresh literals here.
      const values = {
        name: input.name,
        description: input.description ?? null,
        fields,
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
    input: { name?: string; description?: string; fields?: ContentFieldInput[] },
  ): Promise<ContentTypeRow> {
    const existing = await this.getByRef(tenantId, ref);
    const values: Partial<{
      name: string;
      description: string | null;
      fields: ContentFieldDefinition[];
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
