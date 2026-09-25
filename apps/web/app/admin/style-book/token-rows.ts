// Pure helpers for the token editor: rows <-> flat token map, plus the
// grouping and ordering rules the editor and the preview share. Validation
// mirrors the API rules from spec 06.

export const TOKEN_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

export const TOKEN_NAME_HINT =
  'Lowercase letters, digits and dashes, starting with a letter, e.g. color-primary or space-4.';

export interface TokenRow {
  id: number;
  name: string;
  value: string;
}

export function tokensToRows(tokens: Record<string, string>, startId = 1): TokenRow[] {
  return Object.entries(tokens)
    .sort(([a], [b]) => compareTokenNames(a, b))
    .map(([name, value], index) => ({
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

// A full token set is thirty-odd entries, which is an unreadable wall as one
// list. These groups are what the sections are named in the editor, so the
// labels say what the tokens do for the site rather than how they are named:
// someone who has never heard of a design token should still know which
// section to open to recolor the buttons.
//
// Order is meaningful twice over: it is the order the sections render in, and
// tokenGroupKey returns the first group whose prefix matches, so the specific
// color roles have to come before the "color" catch-all, and "color-text"
// before typography's "text".
export const TOKEN_GROUPS: TokenGroup[] = [
  {
    key: 'brand',
    label: 'Brand and buttons',
    prefixes: ['color-primary', 'color-brand', 'color-accent'],
  },
  {
    key: 'status',
    label: 'Alerts and status',
    prefixes: ['color-danger', 'color-error', 'color-warning', 'color-success', 'color-info'],
  },
  {
    key: 'surface',
    label: 'Page and section backgrounds',
    prefixes: ['color-background', 'color-surface', 'color-page', 'color-canvas'],
  },
  {
    key: 'ink',
    label: 'Text and lines',
    prefixes: ['color-text', 'color-border', 'color-link', 'color-muted'],
  },
  { key: 'color', label: 'Other colors', prefixes: ['color'] },
  { key: 'type', label: 'Fonts and text sizes', prefixes: ['font', 'text', 'type', 'line'] },
  { key: 'space', label: 'Spacing', prefixes: ['space', 'spacing', 'gap'] },
  { key: 'radius', label: 'Corners and borders', prefixes: ['radius', 'radii', 'border'] },
  { key: 'shadow', label: 'Shadows', prefixes: ['shadow', 'elevation'] },
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

// Steps of the t-shirt scales the token set uses (space-sm, font-size-2xl,
// radius-full, ...). "full" is last because it is the end of the radius scale.
const SCALE_STEPS = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full'];

// Splits "font-size-2xl" into the family "font-size" and the step's position
// in the scale. A name that does not end in a scale step is its own family and
// sorts after the scales of the same prefix.
function scaleStepOf(name: string): { family: string; step: number } {
  const dash = name.lastIndexOf('-');
  const step = dash === -1 ? -1 : SCALE_STEPS.indexOf(name.slice(dash + 1));
  if (step === -1) {
    return { family: name, step: SCALE_STEPS.length };
  }
  return { family: name.slice(0, dash), step };
}

// jsonb does not preserve insertion order, so without this the editor showed
// the tokens in whatever order Postgres handed them back. Within a group the
// tokens of one family stay together and a scale reads small to large, not
// alphabetically (md before xl, not the other way round).
export function compareTokenNames(a: string, b: string): number {
  const groupOrder =
    TOKEN_GROUPS.findIndex((group) => group.key === tokenGroupKey(a)) -
    TOKEN_GROUPS.findIndex((group) => group.key === tokenGroupKey(b));
  if (groupOrder !== 0) {
    return groupOrder;
  }
  const left = scaleStepOf(a.trim());
  const right = scaleStepOf(b.trim());
  if (left.family !== right.family) {
    return left.family.localeCompare(right.family);
  }
  return left.step - right.step || a.localeCompare(b);
}
