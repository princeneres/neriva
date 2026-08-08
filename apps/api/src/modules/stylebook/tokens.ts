// Token map rules (spec 06): names match ^[a-z][a-z0-9-]*$, values are
// non-empty strings. CSS variables are rendered with the --nv- prefix.

export const TOKEN_NAME_RE = /^[a-z][a-z0-9-]*$/;

export interface TokenViolations {
  invalidNames: string[];
  invalidValues: string[];
}

// Returns the offending keys, or null when the map is valid.
export function findTokenViolations(tokens: Record<string, unknown>): TokenViolations | null {
  const invalidNames: string[] = [];
  const invalidValues: string[] = [];
  for (const [name, value] of Object.entries(tokens)) {
    if (!TOKEN_NAME_RE.test(name)) {
      invalidNames.push(name);
    }
    if (typeof value !== 'string' || value.trim().length === 0) {
      invalidValues.push(name);
    }
  }
  if (invalidNames.length === 0 && invalidValues.length === 0) {
    return null;
  }
  return { invalidNames, invalidValues };
}

// Names are sorted so the output is deterministic: jsonb does not preserve
// insertion order.
export function renderCss(tokens: Record<string, string>): string {
  const lines = Object.entries(tokens)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `  --nv-${name}: ${value};`);
  if (lines.length === 0) {
    return ':root {\n}\n';
  }
  return `:root {\n${lines.join('\n')}\n}\n`;
}
