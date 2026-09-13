import {
  and,
  asc,
  eq,
  gt,
  type InferInsertModel,
  type InferSelectModel,
  type SQL,
} from 'drizzle-orm';
import type { AnyPgColumn, PgTable, PgUpdateSetSource } from 'drizzle-orm/pg-core';
import { parseEntityRef } from '../common/entity-ref';
import { clampLimit, decodeCursor, encodeCursor } from '../common/pagination';
import type { Database } from './database';

export type EnvelopeTable = PgTable & {
  id: AnyPgColumn;
  externalReferenceCode: AnyPgColumn;
  tenantId: AnyPgColumn;
  updatedAt: AnyPgColumn;
};

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  limit: number;
}

// Generic repository over any enveloped table. The tenant filter is applied
// inside this class on every statement; callers never build their own WHERE,
// so forgetting tenant scoping is impossible by construction.
//
// Drizzle loses column-level inference on generic table parameters, so results
// are cast back to the models inferred from the concrete table. The casts are
// safe: every statement targets `this.table` and EnvelopeTable constrains its
// shape.
export class TenantScopedRepository<TTable extends EnvelopeTable> {
  constructor(
    private readonly db: Database,
    private readonly table: TTable,
    readonly tenantId: string,
  ) {}

  private scoped(...conditions: (SQL | undefined)[]): SQL {
    // and() only returns undefined when given zero conditions; the tenant
    // filter is always present.
    return and(eq(this.table.tenantId, this.tenantId), ...conditions) as SQL;
  }

  async findById(id: string): Promise<InferSelectModel<TTable> | null> {
    const rows = await this.db
      .select()
      .from(this.table as PgTable)
      .where(this.scoped(eq(this.table.id, id)))
      .limit(1);
    return (rows[0] as InferSelectModel<TTable> | undefined) ?? null;
  }

  async findByErc(externalReferenceCode: string): Promise<InferSelectModel<TTable> | null> {
    const rows = await this.db
      .select()
      .from(this.table as PgTable)
      .where(this.scoped(eq(this.table.externalReferenceCode, externalReferenceCode)))
      .limit(1);
    return (rows[0] as InferSelectModel<TTable> | undefined) ?? null;
  }

  // Accepts a UUID or erc:<externalReferenceCode> (URL id convention).
  async findByRef(ref: string): Promise<InferSelectModel<TTable> | null> {
    const parsed = parseEntityRef(ref);
    return parsed.kind === 'id' ? this.findById(parsed.value) : this.findByErc(parsed.value);
  }

  async list(
    params: { limit?: number; cursor?: string } = {},
  ): Promise<CursorPage<InferSelectModel<TTable>>> {
    const limit = clampLimit(params.limit);
    const cursorCondition = params.cursor
      ? gt(this.table.id, decodeCursor(params.cursor).id)
      : undefined;

    // Fetch one extra row to know whether a next page exists. UUIDv7 ids are
    // time-ordered, so ordering by id doubles as ordering by creation.
    const rows = await this.db
      .select()
      .from(this.table as PgTable)
      .where(this.scoped(cursorCondition))
      .orderBy(asc(this.table.id))
      .limit(limit + 1);

    const items = rows.slice(0, limit) as InferSelectModel<TTable>[];
    const last = items[items.length - 1] as { id: string } | undefined;
    const nextCursor = rows.length > limit && last ? encodeCursor(last.id) : null;
    return { items, nextCursor, limit };
  }

  async create(
    values: Omit<InferInsertModel<TTable>, 'tenantId'>,
  ): Promise<InferSelectModel<TTable>> {
    const rows = await this.db
      .insert(this.table)
      .values({ ...values, tenantId: this.tenantId } as InferInsertModel<TTable>)
      .returning();
    return rows[0] as InferSelectModel<TTable>;
  }

  async updateById(
    id: string,
    values: Partial<Omit<InferInsertModel<TTable>, 'id' | 'tenantId'>>,
  ): Promise<InferSelectModel<TTable> | null> {
    const rows = (await this.db
      .update(this.table)
      .set({ ...values, updatedAt: new Date() } as PgUpdateSetSource<TTable>)
      .where(this.scoped(eq(this.table.id, id)))
      .returning()) as InferSelectModel<TTable>[];
    return rows[0] ?? null;
  }

  // Compare-and-set update for editors. The timestamp is returned by every
  // entity response, so API clients can prevent an older draft from silently
  // overwriting a newer one.
  async updateByIdIfUnmodified(
    id: string,
    expectedUpdatedAt: Date,
    values: Partial<Omit<InferInsertModel<TTable>, 'id' | 'tenantId'>>,
  ): Promise<InferSelectModel<TTable> | null> {
    const rows = (await this.db
      .update(this.table)
      .set({ ...values, updatedAt: new Date() } as PgUpdateSetSource<TTable>)
      .where(this.scoped(and(eq(this.table.id, id), eq(this.table.updatedAt, expectedUpdatedAt))))
      .returning()) as InferSelectModel<TTable>[];
    return rows[0] ?? null;
  }

  async deleteById(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(this.table)
      .where(this.scoped(eq(this.table.id, id)))
      .returning();
    return rows.length > 0;
  }

  async upsertByErc(
    externalReferenceCode: string,
    values: Omit<InferInsertModel<TTable>, 'tenantId' | 'externalReferenceCode'>,
  ): Promise<InferSelectModel<TTable>> {
    const rows = await this.db
      .insert(this.table)
      .values({
        ...values,
        tenantId: this.tenantId,
        externalReferenceCode,
      } as InferInsertModel<TTable>)
      .onConflictDoUpdate({
        target: [this.table.tenantId, this.table.externalReferenceCode],
        set: { ...values, updatedAt: new Date() },
      })
      .returning();
    return rows[0] as InferSelectModel<TTable>;
  }
}
