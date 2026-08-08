// Pure helpers for the token editor: rows <-> flat token map plus
// client-side validation mirroring the API rules from spec 06.

export const TOKEN_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

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

export function validateTokenRows(rows: TokenRow[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const name = row.name.trim();
    if (!TOKEN_NAME_PATTERN.test(name)) {
      errors.push(
        `Token name "${name}" is invalid: use lowercase letters, digits and dashes, starting with a letter.`,
      );
    } else if (seen.has(name)) {
      errors.push(`Duplicate token name "${name}".`);
    } else {
      seen.add(name);
    }
    if (row.value.trim() === '') {
      errors.push(`Token "${name || '(unnamed)'}" needs a non-empty value.`);
    }
  }
  return errors;
}
