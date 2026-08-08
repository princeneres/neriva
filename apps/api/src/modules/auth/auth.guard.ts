import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { and, eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { DB, type Database } from '../../db/database';
import { users } from '../../db/schema';
import { IS_PUBLIC_KEY } from './auth.decorators';
import type { AccessTokenPayload, AuthenticatedUser } from './auth.types';

// Global bearer-token guard. Loads the user fresh from the DB on every
// request so revocations and mustChangePassword flips apply immediately.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject(DB) private readonly db: Database,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: AuthenticatedUser }>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException({ detail: 'Missing bearer token' });
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException({ detail: 'Invalid or expired access token' });
    }

    const user = (
      await this.db
        .select()
        .from(users)
        .where(and(eq(users.id, payload.sub), eq(users.tenantId, payload.tenantId)))
        .limit(1)
    )[0];
    if (!user) {
      throw new UnauthorizedException({ detail: 'User no longer exists' });
    }

    request.user = user;
    return true;
  }
}

function extractBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}
