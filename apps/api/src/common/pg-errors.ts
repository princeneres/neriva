// Postgres error code for unique_violation.
const UNIQUE_VIOLATION = '23505';
// Postgres error code for invalid_text_representation (failed cast).
const INVALID_TEXT_REPRESENTATION = '22P02';
// Postgres error code for foreign_key_violation.
const FOREIGN_KEY_VIOLATION = '23503';

// Drizzle 0.45 wraps driver failures in a DrizzleQueryError and keeps the pg
// error as its `cause`, so the code is no longer on the thrown object itself.
// Walking the chain keeps both shapes working and survives another layer of
// wrapping. The depth cap is there only so a self-referencing cause cannot
// spin forever.
const MAX_CAUSE_DEPTH = 5;

function hasPgCode(error: unknown, code: string): boolean {
  let current = error;
  for (let depth = 0; depth <= MAX_CAUSE_DEPTH; depth += 1) {
    if (typeof current !== 'object' || current === null) {
      return false;
    }
    if ('code' in current && (current as { code: unknown }).code === code) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export function isUniqueViolation(error: unknown): boolean {
  return hasPgCode(error, UNIQUE_VIOLATION);
}

export function isInvalidTextRepresentation(error: unknown): boolean {
  return hasPgCode(error, INVALID_TEXT_REPRESENTATION);
}

export function isForeignKeyViolation(error: unknown): boolean {
  return hasPgCode(error, FOREIGN_KEY_VIOLATION);
}
