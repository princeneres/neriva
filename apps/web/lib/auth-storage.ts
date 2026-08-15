// Client-side token storage for the admin shell. The skeleton keeps tokens in
// localStorage and calls the API directly; hardening (httpOnly cookie proxy)
// is a later, deliberate step.
import { clearCache } from './client-cache';
import { clearSessionUser } from './session-user';

const ACCESS_TOKEN_KEY = 'neriva.accessToken';
const REFRESH_TOKEN_KEY = 'neriva.refreshToken';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export function saveTokens(tokens: StoredTokens): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  // Losing the session must lose everything read under it: no cached list or
  // profile may bleed into the next sign-in.
  clearCache();
  clearSessionUser();
}
