import { ValidationPipe } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ProblemDetailsFilter } from './common/problem-details.filter';

// Shared between main.ts and e2e tests so both run the exact same pipeline.
export function configureApp(app: NestFastifyApplication): void {
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableShutdownHooks();
}
