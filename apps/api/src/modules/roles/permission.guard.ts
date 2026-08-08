import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AbilityFactory } from './ability.factory';
import { REQUIRE_PERMISSION_KEY } from './require-permission.decorator';

// Global guard behind @RequirePermission. Routes without the decorator only
// require authentication (AuthGuard runs first).
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string | undefined>(REQUIRE_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: AuthenticatedUser }>();
    if (!request.user) {
      throw new ForbiddenException({ detail: 'Permission check requires authentication' });
    }

    const [resourceType, action] = required.split(':');
    if (!resourceType || !action) {
      throw new Error(`Malformed @RequirePermission value: "${required}"`);
    }

    const ability = await this.abilityFactory.createForUser(request.user);
    if (!ability.can(action, resourceType)) {
      throw new ForbiddenException({
        detail: `Missing permission ${required}`,
        code: 'PERMISSION_DENIED',
      });
    }
    return true;
  }
}
