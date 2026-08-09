// Control characters are exactly what this rule guards against embedding by
// accident; here matching them is the whole point (spec 11 sanitization).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

// Sanitizes an uploaded display name (spec 11): strips control characters,
// keeps only the last path segment, and never returns an empty string.
export function sanitizeFileName(raw: string): string {
  const lastSegment = raw.replace(CONTROL_CHARS, '').split(/[/\\]/).pop() ?? '';
  const bounded = lastSegment.trim().slice(0, 255);
  if (bounded === '' || bounded === '.' || bounded === '..') {
    return 'file';
  }
  return bounded;
}
