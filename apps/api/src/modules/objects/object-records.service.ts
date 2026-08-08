import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { InferSelectModel } from 'drizzle-orm';
import { sql, type Selectable } from 'kysely';
import { clampLimit, decodeCursor, encodeCursor } from '../../common/pagination';
import { isInvalidTextRepresentation, isUniqueViolation } from '../../common/pg-errors';
import { DB, type Database } from '../../db/database';
import { objectRecords } from '../../db/schema';
import { TenantScopedRepository, type CursorPage } from '../../db/tenant-scoped.repository';
import { ObjectDefinitionsService } from './object-definitions.service';
import { validateRecordData } from './object-field.validation';
import { parseRecordFilters, parseRecordSort, type RecordFilter } from './record-filter';
import { OBJECTS_KYSELY, type ObjectRecordsTable, type ObjectsKysely } from './objects.kysely';

export type ObjectRecordRow = InferSelectModel<typeof objectRecords>;

// Kysely rows are snake_case; map back to the camelCase Drizzle model so
// every service method returns the same shape.
function toRecordRow(row: Selectable<ObjectRecordsTable>): ObjectRecordRow {
  return {
    id: row.id,
    externalReferenceCode: row.external_reference_code,
    tenantId: row.tenant_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    objectDefinitionId: row.object_definition_id,
    data: row.data,
  };
}

// Equality on a JSONB field via ->> extraction, cast by the declared field
// type so numbers and booleans compare by value, not text.
function filterCondition(filter: RecordFilter) {
  const { field, value } = filter;
  switch (field.type) {
    case 'number':
      return sql<boolean>`(data ->> ${field.key}::text)::numeric = ${value}`;
    case 'boolean':
      return sql<boolean>`(data ->> ${field.key}::text)::boolean = ${value}`;
    default:
      return sql<boolean>`data ->> ${field.key}::text = ${value}`;
  }
}

@Injectable()
export class ObjectRecordsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(OBJECTS_KYSELY) private readonly kysely: ObjectsKysely,
    private readonly definitionsService: ObjectDefinitionsService,
  ) {}

  private repo(tenantId: string): TenantScopedRepository<typeof objectRecords> {
    return new TenantScopedRepository(this.db, objectRecords, tenantId);
  }

  async create(
    tenantId: string,
    createdBy: string,
    definitionRef: string,
    input: { data: Record<string, unknown>; externalReferenceCode?: string },
  ): Promise<ObjectRecordRow> {
    const definition = await this.definitionsService.getByRef(tenantId, definitionRef);
    validateRecordData(definition.fields, input.data);
    try {
      const values = {
        objectDefinitionId: definition.id,
        data: input.data,
        createdBy,
        externalReferenceCode: input.externalReferenceCode,
      };
      return await this.repo(tenantId).create(values);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ detail: 'An object record with this ERC already exists' });
      }
      throw error;
    }
  }

  async getByRef(tenantId: string, ref: string): Promise<ObjectRecordRow> {
    const record = await this.repo(tenantId).findByRef(ref);
    if (!record) {
      throw new NotFoundException({ detail: `Object record ${ref} not found` });
    }
    return record;
  }

  async update(
    tenantId: string,
    ref: string,
    input: { data?: Record<string, unknown> },
  ): Promise<ObjectRecordRow> {
    const existing = await this.getByRef(tenantId, ref);
    if (input.data === undefined) {
      return existing;
    }
    const definition = await this.definitionsService.getByRef(
      tenantId,
      existing.objectDefinitionId,
    );
    validateRecordData(definition.fields, input.data);
    const updated = await this.repo(tenantId).updateById(existing.id, { data: input.data });
    return updated ?? existing;
  }

  async delete(tenantId: string, ref: string): Promise<void> {
    const existing = await this.getByRef(tenantId, ref);
    await this.repo(tenantId).deleteById(existing.id);
  }

  // Dynamic listing (spec 05): equality filters and sorting over
  // runtime-defined JSONB fields, built with Kysely. The tenant filter is
  // always the first WHERE clause.
  async listByDefinition(
    tenantId: string,
    definitionRef: string,
    query: { limit?: number; cursor?: string; sort?: string },
    rawQuery: Record<string, unknown>,
  ): Promise<CursorPage<ObjectRecordRow>> {
    const definition = await this.definitionsService.getByRef(tenantId, definitionRef);
    const filters = parseRecordFilters(rawQuery, definition.fields);
    const sort = parseRecordSort(query.sort, definition.fields);
    if (sort && query.cursor !== undefined) {
      throw new BadRequestException({
        detail: 'sort cannot be combined with cursor (v1 limitation)',
      });
    }
    const limit = clampLimit(query.limit);

    let qb = this.kysely
      .selectFrom('object_records')
      .selectAll()
      .where('tenant_id', '=', tenantId)
      .where('object_definition_id', '=', definition.id);
    for (const filter of filters) {
      qb = qb.where(filterCondition(filter));
    }
    if (query.cursor !== undefined) {
      qb = qb.where('id', '>', decodeCursor(query.cursor).id);
    }
    if (sort) {
      const extraction =
        sort.field.type === 'number'
          ? sql`(data ->> ${sort.field.key}::text)::numeric`
          : sort.field.type === 'boolean'
            ? sql`(data ->> ${sort.field.key}::text)::boolean`
            : sql`data ->> ${sort.field.key}::text`;
      qb = qb.orderBy(extraction, sort.direction).orderBy('id', 'asc');
    } else {
      qb = qb.orderBy('id', 'asc');
    }

    let rows;
    try {
      rows = await qb.limit(limit + 1).execute();
    } catch (error) {
      // Records written before a definition field changed type may hold
      // values the ::numeric/::boolean casts cannot parse; that is a data
      // shape problem for the caller, not a server fault.
      if (isInvalidTextRepresentation(error)) {
        throw new BadRequestException({
          detail:
            'Stored record values are incompatible with the current field types; ' +
            'remove the filter/sort on the affected field or fix the records',
        });
      }
      throw error;
    }
    const items = rows.slice(0, limit).map(toRecordRow);
    const last = items[items.length - 1];
    // A cursor is only meaningful with the default id ordering.
    const nextCursor = !sort && rows.length > limit && last ? encodeCursor(last.id) : null;
    return { items, nextCursor, limit };
  }
}
