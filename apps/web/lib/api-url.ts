export function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
