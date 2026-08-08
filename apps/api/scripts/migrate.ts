import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

// Run from apps/api (pnpm db:migrate); the migrations folder resolves
// relative to the working directory.
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? 'postgres://neriva:neriva@localhost:5432/neriva';
  const pool = new Pool({ connectionString: url });
  await migrate(drizzle(pool), { migrationsFolder: 'drizzle' });
  await pool.end();
  console.log('Migrations applied');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
