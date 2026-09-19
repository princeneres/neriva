import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { STATUS_CODES } from 'node:http';
import { InvalidCursorError } from './pagination';

// RFC 7807 problem+json for every error response (CLAUDE.md API convention).
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let status = 500;
    let detail: string | undefined;
    const extensions: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string') {
        detail = response;
      } else {
        const body = response as Record<string, unknown>;
        if (typeof body.detail === 'string') {
          detail = body.detail;
        } else if (Array.isArray(body.message)) {
          detail = 'Request validation failed';
          extensions.errors = body.message;
        } else if (typeof body.message === 'string') {
          detail = body.message;
        }
        if (typeof body.code === 'string') {
          extensions.code = body.code;
        }
      }
    } else if (exception instanceof InvalidCursorError) {
      status = 400;
      detail = exception.message;
    } else if (exception instanceof Error) {
      // This filter replaces Nest's default handler, so unexpected errors
      // must be logged here or they vanish entirely.
      this.logger.error(
        `Unhandled error on ${request.method} ${request.url}: ${exception.message}`,
        exception.stack,
      );
      // Unexpected errors may contain SQL, filesystem paths or credentials in
      // staging as well as production. Keep details in logs only.
      detail = undefined;
    } else {
      this.logger.error(
        `Unhandled non-Error thrown on ${request.method} ${request.url}: ${String(exception)}`,
      );
    }

    void reply
      .status(status)
      .header('content-type', 'application/problem+json')
      .send({
        type: 'about:blank',
        title: STATUS_CODES[status] ?? 'Error',
        status,
        ...(detail !== undefined ? { detail } : {}),
        instance: request.url,
        ...extensions,
      });
  }
}
