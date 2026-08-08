import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { and, eq, isNull } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { parseDurationMs } from '../../common/duration';
import { DB, type Database } from '../../db/database';
import { refreshTokens, tenants, users } from '../../db/schema';
import { DEFAULT_TENANT_ERC } from '../../db/seed.service';
import type { AccessTokenPayload, AuthTokens, UserRow } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<AuthTokens> {
    // v1 ships single-tenant deploys; login always targets the default tenant.
    const tenant = (
      await this.db
        .select()
        .from(tenants)
        .where(eq(tenants.externalReferenceCode, DEFAULT_TENANT_ERC))
        .limit(1)
    )[0];
    if (!tenant) {
      throw new NotFoundException({ detail: 'Default tenant is not provisioned' });
    }

    const user = (
      await this.db
        .select()
        .from(users)
        .where(and(eq(users.tenantId, tenant.id), eq(users.email, email)))
        .limit(1)
    )[0];
    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException({ detail: 'Invalid email or password' });
    }

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const row = await this.findActiveRefreshToken(refreshToken);
    if (!row) {
      throw new UnauthorizedException({ detail: 'Invalid or expired refresh token' });
    }

    // Rotation: each refresh token is single-use. The conditional update is
    // the atomic claim; a concurrent refresh with the same token loses the
    // race and is rejected instead of receiving a second pair.
    const revoked = await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.id, row.id), isNull(refreshTokens.revokedAt)))
      .returning({ id: refreshTokens.id });
    if (revoked.length === 0) {
      throw new UnauthorizedException({ detail: 'Invalid or expired refresh token' });
    }

    const user = (
      await this.db
        .select()
        .from(users)
        .where(and(eq(users.id, row.userId), eq(users.tenantId, row.tenantId)))
        .limit(1)
    )[0];
    if (!user) {
      throw new UnauthorizedException({ detail: 'User no longer exists' });
    }
    return this.issueTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const row = await this.findActiveRefreshToken(refreshToken);
    if (row) {
      await this.db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.id, row.id));
    }
  }

  async changePassword(
    user: UserRow,
    currentPassword: string,
    newPassword: string,
  ): Promise<AuthTokens> {
    if (!(await argon2.verify(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException({ detail: 'Current password is incorrect' });
    }

    const passwordHash = await argon2.hash(newPassword);
    const [updated] = await this.db
      .update(users)
      .set({ passwordHash, mustChangePassword: false, updatedAt: new Date() })
      .where(and(eq(users.id, user.id), eq(users.tenantId, user.tenantId)))
      .returning();
    if (!updated) {
      throw new UnauthorizedException({ detail: 'User no longer exists' });
    }

    // Invalidate every session created with the old password.
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, user.id), isNull(refreshTokens.revokedAt)));

    return this.issueTokens(updated);
  }

  private async issueTokens(user: UserRow): Promise<AuthTokens> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
    };
    const accessToken = await this.jwt.signAsync(payload);

    const refreshToken = randomBytes(32).toString('hex');
    const refreshTtlMs = parseDurationMs(process.env.JWT_REFRESH_TTL ?? '30d');
    await this.db.insert(refreshTokens).values({
      userId: user.id,
      tenantId: user.tenantId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + refreshTtlMs),
    });

    return { accessToken, refreshToken, mustChangePassword: user.mustChangePassword };
  }

  private async findActiveRefreshToken(refreshToken: string) {
    const row = (
      await this.db
        .select()
        .from(refreshTokens)
        .where(
          and(
            eq(refreshTokens.tokenHash, hashRefreshToken(refreshToken)),
            isNull(refreshTokens.revokedAt),
          ),
        )
        .limit(1)
    )[0];
    if (!row || row.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    return row;
  }
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
