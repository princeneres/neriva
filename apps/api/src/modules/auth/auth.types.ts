import type { InferSelectModel } from 'drizzle-orm';
import type { users } from '../../db/schema';

export type UserRow = InferSelectModel<typeof users>;

// The full DB row is attached to the request after token verification;
// passwordHash never leaves the service layer.
export type AuthenticatedUser = UserRow;

export interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

export type PublicUser = Omit<UserRow, 'passwordHash'>;

export function toPublicUser(user: UserRow): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}
