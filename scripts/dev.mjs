#!/usr/bin/env node
// One-command development bootstrap (docs/adr/ADR-004-dev-bootstrap.md).
// Resolves a database, then runs the API and the web app side by side with
// prefixed logs. Migrations and seeds run inside the API boot path, so there
// is no separate migrate step.
//
//   pnpm dev              embedded PostgreSQL, API + web
//   pnpm dev --no-demo    same, without the demo content seed
//   pnpm dev --db-only    only the database, for running the apps by hand
//
// Setting DATABASE_URL (in the environment or .env) switches to that server
// instead of the embedded one.
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import EmbeddedPostgres from 'embedded-postgres';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Port 5433, not 5432, so the embedded cluster and the docker-compose one can
// coexist without either having to be stopped first.
const EMBEDDED = {
  dataDir: resolve(ROOT, '.neriva/pgdata'),
  user: 'neriva',
  password: 'neriva',
  database: 'neriva',
  port: Number(process.env.NERIVA_EMBEDDED_DB_PORT ?? 5433),
};

const COLORS = { dev: '\u001B[33m', db: '\u001B[35m', api: '\u001B[36m', web: '\u001B[32m' };
const RESET = '\u001B[0m';

function log(scope, message) {
  process.stdout.write(`${COLORS[scope]}[${scope}]${RESET} ${message}\n`);
}

function pipeWithPrefix(stream, target, scope) {
  let pending = '';
  stream.on('data', (chunk) => {
    pending += chunk.toString();
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    for (const line of lines) {
      target.write(`${COLORS[scope]}[${scope}]${RESET} ${line}\n`);
    }
  });
  stream.on('end', () => {
    if (pending.length > 0) {
      target.write(`${COLORS[scope]}[${scope}]${RESET} ${pending}\n`);
    }
  });
}

function ensureEnvFile() {
  const envPath = resolve(ROOT, '.env');
  if (!existsSync(envPath)) {
    copyFileSync(resolve(ROOT, '.env.example'), envPath);
    log('dev', 'created .env from .env.example');
  }
  loadEnv({ path: envPath });
}

async function isReachable(host, port) {
  return new Promise((done) => {
    const socket = createConnection({ host, port });
    const settle = (result) => {
      socket.destroy();
      done(result);
    };
    socket.setTimeout(1000, () => settle(false));
    socket.once('connect', () => settle(true));
    socket.once('error', () => settle(false));
  });
}

async function waitForDatabase(host, port, attempts = 30) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await isReachable(host, port)) {
      return true;
    }
    await new Promise((done) => setTimeout(done, 1000));
  }
  return false;
}

async function startEmbeddedPostgres() {
  const firstRun = !existsSync(EMBEDDED.dataDir);
  const postgres = new EmbeddedPostgres({
    databaseDir: EMBEDDED.dataDir,
    user: EMBEDDED.user,
    password: EMBEDDED.password,
    port: EMBEDDED.port,
    persistent: true,
    onLog: (message) => log('db', String(message).trimEnd()),
    onError: (message) => log('db', String(message).trimEnd()),
  });

  if (firstRun) {
    log('db', 'first run: initialising the cluster in .neriva/pgdata');
    await postgres.initialise();
  }
  await postgres.start();
  if (firstRun) {
    await postgres.createDatabase(EMBEDDED.database);
  }
  log('db', `embedded PostgreSQL ready on port ${EMBEDDED.port}`);
  return postgres;
}

async function resolveDatabase() {
  const configured = process.env.DATABASE_URL;
  if (configured) {
    const { hostname, port } = new URL(configured);
    const tcpPort = Number(port === '' ? 5432 : port);
    log('dev', `using DATABASE_URL (${hostname}:${tcpPort})`);
    if (!(await waitForDatabase(hostname, tcpPort))) {
      throw new Error(
        `Cannot reach the database at ${hostname}:${tcpPort}. Start it with "docker compose up -d", ` +
          'or remove DATABASE_URL from .env to use the embedded PostgreSQL.',
      );
    }
    return { url: configured, postgres: undefined };
  }

  const postgres = await startEmbeddedPostgres();
  const url = `postgres://${EMBEDDED.user}:${EMBEDDED.password}@127.0.0.1:${EMBEDDED.port}/${EMBEDDED.database}`;
  return { url, postgres };
}

function startApp(scope, filter, env) {
  const child = spawn('pnpm', ['--filter', filter, 'dev'], {
    cwd: ROOT,
    env: { ...process.env, ...env, FORCE_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    // Own process group, so Ctrl+C reaches this script only and the whole
    // pnpm -> nest/next process tree can be torn down together below.
    detached: process.platform !== 'win32',
  });
  pipeWithPrefix(child.stdout, process.stdout, scope);
  pipeWithPrefix(child.stderr, process.stderr, scope);
  return child;
}

function stopApp(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  try {
    if (process.platform === 'win32') {
      child.kill('SIGTERM');
    } else {
      process.kill(-child.pid, 'SIGTERM');
    }
  } catch {
    // The process tree is already gone.
  }
}

let shuttingDown = false;

async function shutdown(children, postgres, code) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of children) {
    stopApp(child);
  }
  if (postgres) {
    log('dev', 'stopping the embedded PostgreSQL');
    await postgres.stop();
  }
  process.exit(code);
}

async function main() {
  const flags = new Set(process.argv.slice(2));
  ensureEnvFile();

  const { url, postgres } = await resolveDatabase();

  if (flags.has('--db-only')) {
    log('dev', `database ready at ${url}`);
    process.on('SIGINT', () => void shutdown([], postgres, 0));
    process.on('SIGTERM', () => void shutdown([], postgres, 0));
    return;
  }

  const sharedEnv = { DATABASE_URL: url };
  if (flags.has('--no-demo')) {
    sharedEnv.SEED_DEMO = 'false';
  }

  const children = [
    startApp('api', '@neriva/api', sharedEnv),
    startApp('web', '@neriva/web', sharedEnv),
  ];

  for (const child of children) {
    child.on('exit', (code, signal) => {
      if (shuttingDown) {
        return;
      }
      log('dev', `a process exited (${signal ?? code ?? 0}), stopping the rest`);
      void shutdown(children, postgres, code ?? 1);
    });
  }

  process.on('SIGINT', () => void shutdown(children, postgres, 0));
  process.on('SIGTERM', () => void shutdown(children, postgres, 0));

  log('dev', 'API on http://localhost:3001, site on http://localhost:3000');
  log(
    'dev',
    'admin on http://localhost:3000/admin, sign in as admin@neriva.com with NERIVA_INITIAL_ADMIN_PASSWORD from .env',
  );
}

main().catch((error) => {
  log('dev', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
