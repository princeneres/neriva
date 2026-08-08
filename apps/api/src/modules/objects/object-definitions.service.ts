import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { InferSelectModel } from 'drizzle-orm';
import { isUniqueViolation } from '../../common/pg-errors';
import { DB, type Database } from '../../db/database';
import { objectDefinitions, type ObjectFieldDefinition } from '../../db/schema';
import { TenantScopedRepository, type CursorPage } from '../../db/tenant-scoped.repository';
import { validateDefinitionFields } from './object-field.validation';

export type ObjectDefinitionRow = InferSelectModel<typeof objectDefinitions>;

// Postgres error code for foreign_key_violation. Local to this module:
// only the definition delete path needs it.
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
export class ObjectDefinitionsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private repo(tenantId: string): TenantScopedRepository<typeof objectDefinitions> {
    return new TenantScopedRepository(this.db, objectDefinitions, tenantId);
  }

  async list(
    tenantId: string,
    params: { limit?: number; cursor?: string },
  ): Promise<CursorPage<ObjectDefinitionRow>> {
    return this.repo(tenantId).list(params);
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
    },
  ): Promise<ObjectDefinitionRow> {
    validateDefinitionFields(input.fields);
    try {
      // Intermediate variable: tsc cannot apply the excess-property check to
      // the generic repository parameter and rejects fresh literals here.
      const values = {
        name: input.name,
        pluralName: input.pluralName,
        description: input.description ?? null,
        fields: input.fields,
        createdBy,
        // undefined lets the envelope default generate one
        externalReferenceCode: input.externalReferenceCode,
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
    },
  ): Promise<ObjectDefinitionRow> {
    const existing = await this.getByRef(tenantId, ref);
    const values: Partial<{
      name: string;
      pluralName: string;
      description: string | null;
      fields: ObjectFieldDefinition[];
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
