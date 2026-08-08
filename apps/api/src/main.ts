import 'reflect-metadata';
import helmet from '@fastify/helmet';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { runMigrations } from './db/run-migrations';

async function bootstrap(): Promise<void> {
  if (process.env.RUN_MIGRATIONS === 'true') {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set');
    }
    await runMigrations(url);
    new Logger('Bootstrap').log('Migrations applied');
  }

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  await app.register(helmet);
  configureApp(app);
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
