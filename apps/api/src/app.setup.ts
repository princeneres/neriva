import { ValidationPipe } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { EnvelopeInterceptor } from './common/envelope.interceptor';
import { ProblemDetailsFilter } from './common/problem-details.filter';

// Shared between main.ts and e2e tests so both run the exact same pipeline.
export function configureApp(app: NestFastifyApplication): void {
  // The admin UI is a separate origin; auth uses bearer tokens, not cookies.
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.useGlobalInterceptors(new EnvelopeInterceptor());
  app.enableShutdownHooks();
}
