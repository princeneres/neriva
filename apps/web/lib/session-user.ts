// Last known profile of the signed-in user, kept for the browser session.
//
// The admin layout renders nothing until it knows who is logged in, so a cold
// `/auth/me` round trip means a blank screen on every reload. Caching the
// profile lets the shell paint immediately while the real call revalidates.
// It carries no credential: the tokens still gate every request, and a stale
// or forged entry only decides which name the sidebar draws for one frame
// before `/auth/me` corrects it or bounces to the login screen.

import type { PublicUser } from './api';

const STORAGE_KEY = 'neriva.sessionUser';

// Module scope survives client navigation; sessionStorage survives reload.
let cached: PublicUser | null = null;

function storage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.sessionStorage;
  } catch {
    // Storage can throw when cookies are blocked; the cache is optional.
    return null;
  }
}

export function readSessionUser(): PublicUser | null {
  if (cached) {
    return cached;
  }
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    cached = JSON.parse(raw) as PublicUser;
    return cached;
  } catch {
    return null;
  }
}

export function saveSessionUser(user: PublicUser): void {
  cached = user;
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Quota or private-mode failures leave the module-scope copy in place.
  }
}

export function clearSessionUser(): void {
  cached = null;
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to recover: the module-scope copy is already gone.
  }
}
