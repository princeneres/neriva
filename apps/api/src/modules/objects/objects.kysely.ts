import { Kysely, PostgresDialect } from 'kysely';
import type { Pool } from 'pg';

export const OBJECTS_KYSELY = Symbol('OBJECTS_KYSELY');

// Minimal Kysely schema: only the table that needs dynamic query building
// over runtime-defined fields (CLAUDE.md limits Kysely to exactly that).
export interface ObjectRecordsTable {
  id: string;
  external_reference_code: string;
  tenant_id: string;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  object_definition_id: string;
  data: Record<string, unknown>;
}

export interface ObjectsQuerySchema {
  object_records: ObjectRecordsTable;
}

export type ObjectsKysely = Kysely<ObjectsQuerySchema>;

// The pg Pool is owned by DbModule (PoolLifecycle closes it on shutdown);
// Kysely only borrows it, so destroy() is never called here.
export function createObjectsKysely(pool: Pool): ObjectsKysely {
  return new Kysely<ObjectsQuerySchema>({ dialect: new PostgresDialect({ pool }) });
}
