import 'reflect-metadata';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import helmet from '@fastify/helmet';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { runMigrations } from './db/run-migrations';

// dotenv never overrides variables already set in the environment, so loading
// the app-local .env first and the repo-root .env second is safe regardless of
// the working directory (apps/api in dev, repo root otherwise).
loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(process.cwd(), '../../.env') });

// Outside production, migrations run on boot so `pnpm dev` needs no separate
// migrate step. Production keeps them an explicit deploy step (RUN_MIGRATIONS
// =true), and RUN_MIGRATIONS=false opts out anywhere.
function shouldRunMigrations(): boolean {
  if (process.env.RUN_MIGRATIONS === 'true') {
    return true;
  }
  if (process.env.RUN_MIGRATIONS === 'false') {
    return false;
  }
  return process.env.NODE_ENV !== 'production';
}

async function bootstrap(): Promise<void> {
  if (shouldRunMigrations()) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set');
    }
    await runMigrations(url);
    new Logger('Bootstrap').log('Migrations applied');
  }

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  await app.register(helmet, {
    // The web app on another origin embeds media served by this API
    // (<img src=".../public/media/...">); the default same-origin CORP
    // makes browsers block those images.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  await configureApp(app);
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
