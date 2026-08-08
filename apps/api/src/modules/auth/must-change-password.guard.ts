import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { IS_PUBLIC_KEY, SKIP_MUST_CHANGE_PASSWORD_KEY } from './auth.decorators';
import type { AuthenticatedUser } from './auth.types';

// While mustChangePassword is set, every authenticated request except
// password change and logout is refused (skeleton spec, step 3).
@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_MUST_CHANGE_PASSWORD_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip || isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: AuthenticatedUser }>();
    if (request.user?.mustChangePassword) {
      throw new ForbiddenException({
        detail: 'Password change required before any other operation',
        code: 'MUST_CHANGE_PASSWORD',
      });
    }
    return true;
  }
}
