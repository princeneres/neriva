import { runMigrations } from '../src/db/run-migrations';

// Run from apps/api (pnpm db:migrate); the migrations folder resolves
// relative to the working directory.
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL ?? 'postgres://neriva:neriva@localhost:5432/neriva';
  await runMigrations(url);
  console.log('Migrations applied');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
