// Postgres error code for unique_violation.
const UNIQUE_VIOLATION = '23505';
// Postgres error code for invalid_text_representation (failed cast).
const INVALID_TEXT_REPRESENTATION = '22P02';

function hasPgCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === code
  );
}

export function isUniqueViolation(error: unknown): boolean {
  return hasPgCode(error, UNIQUE_VIOLATION);
}

export function isInvalidTextRepresentation(error: unknown): boolean {
  return hasPgCode(error, INVALID_TEXT_REPRESENTATION);
}
