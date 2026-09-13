import compress from '@fastify/compress';
import multipart from '@fastify/multipart';
import { ValidationPipe } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { EnvelopeInterceptor } from './common/envelope.interceptor';
import { ProblemDetailsFilter } from './common/problem-details.filter';

// Max upload size 25 MB (spec 11); env override exists so tests can exercise
// the 413 path with small payloads.
const DEFAULT_MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Shared between main.ts and e2e tests so both run the exact same pipeline.
export async function configureApp(app: NestFastifyApplication): Promise<void> {
  // The admin UI is a separate origin; auth uses bearer tokens, not cookies.
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  // Nothing compressed responses before this: a delivery page went out at
  // 13.6 kB where 3.6 kB would do (73% smaller), and the site stylesheet at
  // 1.1 kB where 336 B would do. The 1 KB threshold matters in both
  // directions: gzipping a 43-byte envelope makes it larger, so small
  // responses are left alone.
  //
  // Awaited, unlike multipart below. Compression works by adding an onSend
  // hook, and on a cold boot the fire-and-forget form loses the race with
  // Nest's route registration: the hook never joins the handler chain and
  // every response ships uncompressed. Verified as a controlled pair against
  // a cold-booted server. A watch reload happens to load plugins early enough
  // to hide it, which is exactly what makes the bug easy to miss.
  await app.register(compress, { threshold: 1024, encodings: ['br', 'gzip', 'deflate'] });
  // Fastify queues the plugin and loads it on ready(), so no await is needed.
  void app.register(multipart, {
    limits: { fileSize: Number(process.env.MEDIA_MAX_UPLOAD_BYTES ?? DEFAULT_MAX_UPLOAD_BYTES) },
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.useGlobalInterceptors(new EnvelopeInterceptor());
  app.enableShutdownHooks();
}
