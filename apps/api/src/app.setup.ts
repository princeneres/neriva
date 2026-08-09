import multipart from '@fastify/multipart';
import { ValidationPipe } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { EnvelopeInterceptor } from './common/envelope.interceptor';
import { ProblemDetailsFilter } from './common/problem-details.filter';

// Max upload size 25 MB (spec 11); env override exists so tests can exercise
// the 413 path with small payloads.
const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Shared between main.ts and e2e tests so both run the exact same pipeline.
export function configureApp(app: NestFastifyApplication): void {
  // The admin UI is a separate origin; auth uses bearer tokens, not cookies.
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  // Fastify queues the plugin and loads it on ready(), so no await is needed.
  void app.register(multipart, {
    limits: { fileSize: Number(process.env.MEDIA_MAX_UPLOAD_BYTES ?? DEFAULT_MAX_UPLOAD_BYTES) },
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.useGlobalInterceptors(new EnvelopeInterceptor());
  app.enableShutdownHooks();
}
