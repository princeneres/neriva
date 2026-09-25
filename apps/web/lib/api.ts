import type { components } from '@neriva/contracts';
import { apiUrl } from './api-url';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './auth-storage';
import { dedupeInFlight } from './client-cache';

export type AuthTokens = components['schemas']['AuthTokensDto'];
export type PublicUser = components['schemas']['PublicUserDto'];

export interface ProblemDetails {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  code?: string;
  errors?: string[];
}

export interface ListMeta {
  cursor: string | null;
  limit: number;
}

export class ApiError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.detail ?? problem.title ?? `Request failed with status ${problem.status}`);
    this.name = 'ApiError';
  }
}

// Single-flight refresh: concurrent 401s share one refresh round-trip.
let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  refreshing ??= (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return false;
    }
    try {
      const response = await fetch(apiUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        return false;
      }
      const body = (await response.json()) as { data: AuthTokens };
      saveTokens(body.data);
      return true;
    } catch {
      return false;
    } finally {
      // allow the next expiry to trigger a fresh round-trip
      setTimeout(() => {
        refreshing = null;
      }, 0);
    }
  })();
  return refreshing;
}

async function request<T>(path: string, init: RequestInit = {}, allowRetry = true): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      // Only claim a JSON body when one exists: Fastify rejects bodyless
      // requests (e.g. the publish POSTs) that carry this content-type.
      ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (response.status === 401 && allowRetry && getRefreshToken()) {
    if (await tryRefresh()) {
      return request<T>(path, init, false);
    }
    clearTokens();
  }

  if (!response.ok) {
    let problem: ProblemDetails = { status: response.status };
    try {
      problem = (await response.json()) as ProblemDetails;
    } catch {
      // non-JSON error body; keep the bare status
    }
    throw new ApiError(problem);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  // Reads are shared while they are open: the shell and the screen it wraps
  // mount together and regularly ask for the same URL in the same tick. Writes
  // are never shared, since two of them are two intended operations.
  get: <T>(path: string) =>
    dedupeInFlight(`GET ${path}`, () => request<T>(path, { method: 'GET' })),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path: string) => request<undefined>(path, { method: 'DELETE' }),
};

export function login(email: string, password: string): Promise<{ data: AuthTokens }> {
  return api.post('/auth/login', { email, password });
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ data: AuthTokens }> {
  return api.post('/auth/change-password', { currentPassword, newPassword });
}

export function me(): Promise<{ data: PublicUser }> {
  return api.get('/auth/me');
}

export function logout(refreshToken: string): Promise<undefined> {
  return api.post('/auth/logout', { refreshToken });
}
