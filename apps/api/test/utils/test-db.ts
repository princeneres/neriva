import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import type { Database } from '../../src/db/db.module';
import * as schema from '../../src/db/schema';

export interface TestDb {
  container: StartedPostgreSqlContainer;
  pool: Pool;
  db: Database;
  connectionUri: string;
  stop: () => Promise<void>;
}

// Vitest runs with cwd = apps/api, so the migrations folder resolves
// relative to the package root.
export async function startTestDb(): Promise<TestDb> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const connectionUri = container.getConnectionUri();
  const pool = new Pool({ connectionString: connectionUri });
  const db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder: 'drizzle' });
  return {
    container,
    pool,
    db,
    connectionUri,
    stop: async () => {
      await pool.end();
      await container.stop();
    },
  };
}
