import type { components } from '@neriva/contracts';
import { apiUrl } from './api-url';
import { getAccessToken } from './auth-storage';

export type AuthTokens = components['schemas']['AuthTokensDto'];
export type PublicUser = components['schemas']['PublicUserDto'];

export interface ProblemDetails {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  code?: string;
}

export class ApiError extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.detail ?? problem.title ?? `Request failed with status ${problem.status}`);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

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

export function login(email: string, password: string): Promise<{ data: AuthTokens }> {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ data: AuthTokens }> {
  return request('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function me(): Promise<{ data: PublicUser }> {
  return request('/auth/me', { method: 'GET' });
}

export function logout(refreshToken: string): Promise<void> {
  return request('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
}
