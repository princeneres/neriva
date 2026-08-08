import { UUID_RE } from './entity-ref';

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

export class InvalidCursorError extends Error {
  constructor() {
    super('Invalid pagination cursor');
    this.name = 'InvalidCursorError';
  }
}

export function clampLimit(limit?: number): number {
  if (limit === undefined || Number.isNaN(limit)) {
    return DEFAULT_PAGE_LIMIT;
  }
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGE_LIMIT);
}

export function encodeCursor(id: string): string {
  return Buffer.from(JSON.stringify({ id }), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): { id: string } {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'id' in parsed &&
      typeof (parsed as { id: unknown }).id === 'string' &&
      // The id lands in a uuid column comparison; anything else would
      // surface as a Postgres cast error (500) instead of a clean 400.
      UUID_RE.test((parsed as { id: string }).id)
    ) {
      return { id: (parsed as { id: string }).id };
    }
  } catch {
    // fall through to the shared error below
  }
  throw new InvalidCursorError();
}
