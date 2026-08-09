// Spec 13: path prefixes owned by the app shell. The root catch-all serves
// the default site and must never shadow these. Next's router already gives
// static routes precedence; this helper is the explicit, testable guard.
const RESERVED_PREFIXES = ['admin', 'login', 'change-password', 's', '_next', 'api'];

export function isReservedPath(path: string): boolean {
  const first = path.replace(/^\/+/, '').split('/')[0] ?? '';
  return RESERVED_PREFIXES.includes(first.toLowerCase());
}
