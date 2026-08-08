// Pure helpers for the token editor: rows <-> flat token map, plus the
// grouping rules the editor and the preview share. Validation mirrors the
// API rules from spec 06.

export const TOKEN_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

export const TOKEN_NAME_HINT =
  'Lowercase letters, digits and dashes, starting with a letter, e.g. color-primary or space-4.';

export interface TokenRow {
  id: number;
  name: string;
  value: string;
}

export function tokensToRows(tokens: Record<string, string>, startId = 1): TokenRow[] {
  return Object.entries(tokens).map(([name, value], index) => ({
    id: startId + index,
    name,
    value,
  }));
}

export function rowsToTokens(rows: TokenRow[]): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const row of rows) {
    tokens[row.name.trim()] = row.value;
  }
  return tokens;
}

// Any token whose name starts with "color" gets the color picker and shows
// up as a chip in the preview.
export function isColorToken(name: string): boolean {
  return name.trim().startsWith('color');
}

export interface TokenGroup {
  key: string;
  label: string;
  prefixes: string[];
}

export const TOKEN_GROUPS: TokenGroup[] = [
  { key: 'color', label: 'Colors', prefixes: ['color'] },
  { key: 'space', label: 'Spacing', prefixes: ['space', 'spacing'] },
  { key: 'type', label: 'Typography', prefixes: ['font', 'text', 'type', 'line'] },
  { key: 'radius', label: 'Radii and borders', prefixes: ['radius', 'radii', 'border'] },
  { key: 'other', label: 'Other tokens', prefixes: [] },
];

export function tokenGroupKey(name: string): string {
  const trimmed = name.trim();
  for (const group of TOKEN_GROUPS) {
    if (group.prefixes.some((prefix) => trimmed.startsWith(prefix))) {
      return group.key;
    }
  }
  return 'other';
}
