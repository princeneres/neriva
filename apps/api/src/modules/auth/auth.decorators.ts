import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { AuthenticatedUser } from './auth.types';

export const IS_PUBLIC_KEY = 'isPublic';
// Marks a route as reachable without authentication.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const SKIP_MUST_CHANGE_PASSWORD_KEY = 'skipMustChangePassword';
// Marks a route as reachable while a password change is pending
// (password change itself and logout, per the skeleton spec).
export const SkipMustChangePassword = () => SetMetadata(SKIP_MUST_CHANGE_PASSWORD_KEY, true);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest & { user?: AuthenticatedUser }>();
    if (!request.user) {
      throw new Error('CurrentUser used on a route without authentication');
    }
    return request.user;
  },
);
