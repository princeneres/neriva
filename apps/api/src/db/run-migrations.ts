import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createPool } from './database';

// Used by the production boot path (RUN_MIGRATIONS=true) and the migrate
// script. The migrations folder resolves relative to the working directory,
// which must be apps/api.
export async function runMigrations(connectionString: string): Promise<void> {
  const pool = createPool(connectionString);
  try {
    await migrate(drizzle(pool), { migrationsFolder: 'drizzle' });
  } finally {
    await pool.end();
  }
}
