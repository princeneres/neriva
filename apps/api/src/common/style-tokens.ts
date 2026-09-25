// Style Book token CSS rendering (spec 06, dark-mode amendment). Shared
// infrastructure, not a feature module's internals: both the stylebook
// module (its own /css preview) and the delivery module (the public
// /public/sites/:slug/style.css endpoint) render the same Style Book token
// set into CSS and must stay in lockstep, so this lives in common/ rather
// than being duplicated per module.

// The default token set every native block is designed against. It is the
// single source of truth for two things that must never drift apart:
//
//   1. the fallback written into every var() reference in the native block
//      css, so a site with no published Style Book still renders the intended
//      design (apps/api/src/db/native-blocks-seed.service.ts builds those
//      strings from this map);
//   2. the starting token set seeded into the first Style Book, which is what
//      a client actually edits.
//
// It is deliberately small: one entry per decision a client really changes.
// Every token here is consumed by at least one native block, so nothing in it
// is decorative. Colors are the minimalist palette from CLAUDE.md.
export const DEFAULT_STYLE_BOOK_TOKENS = {
  // Brand and action colors.
  'color-primary': '#cc3d47',
  'color-primary-hover': '#b53540',
  'color-primary-contrast': '#ffffff',
  'color-danger': '#9d2637',
  // Surfaces, from the page ground up to the raised ones.
  'color-background': '#ffffff',
  'color-surface': '#faf9f7',
  'color-surface-alt': '#f1efec',
  // Text and lines.
  'color-text': '#1a1917',
  'color-text-muted': '#6f6a63',
  'color-border': '#e5e3df',
  // Typography: two families, one size scale, the leading and the two weights
  // a text block needs.
  'font-body': 'system-ui',
  'font-heading': 'system-ui',
  'font-size-xs': '0.75rem',
  'font-size-sm': '0.875rem',
  'font-size-md': '1rem',
  'font-size-lg': '1.25rem',
  'font-size-xl': '1.5rem',
  'font-size-2xl': '2rem',
  'font-size-3xl': '2.75rem',
  'line-height-body': '1.6',
  'line-height-heading': '1.2',
  'font-weight-strong': '600',
  'font-weight-heading': '700',
  // Spacing scale.
  'space-xs': '0.25rem',
  'space-sm': '0.5rem',
  'space-md': '1rem',
  'space-lg': '2rem',
  'space-xl': '3rem',
  // Corner radii; radius-full is the pill shape.
  'radius-sm': '4px',
  'radius-md': '8px',
  'radius-lg': '12px',
  'radius-full': '999px',
  // Elevation.
  'shadow-sm': '0 1px 3px rgba(26, 25, 23, 0.06)',
  'shadow-md': '0 4px 16px rgba(26, 25, 23, 0.1)',
} as const satisfies Record<string, string>;

export type DefaultTokenName = keyof typeof DEFAULT_STYLE_BOOK_TOKENS;

const DARK_SURFACE_NEUTRAL = '#18181b';
const DARK_SURFACE_ALT_NEUTRAL = '#232327';
const DARK_TEXT_NEUTRAL = '#f4f3f1';
const DARK_TEXT_MUTED_NEUTRAL = '#a29c93';
const DARK_BORDER_NEUTRAL = 'rgba(255, 255, 255, 0.12)';
// A brand red dark enough to read on white is unreadable on #18181b, so the
// destructive role is lightened rather than carried over.
const DARK_DANGER = '#ff6b6b';
// A shadow tinted for a light ground disappears on a dark one, which is why
// the geometry is kept and only the ink is deepened.
const DARK_SHADOWS: Record<string, string> = {
  sm: '0 1px 3px rgba(0, 0, 0, 0.5)',
  md: '0 4px 16px rgba(0, 0, 0, 0.6)',
};

// Best-effort dark counterpart for a token whose name suggests a color
// role: a surface/background gets a dark neutral, text gets a light
// neutral, a border gets a translucent light line instead of a translucent
// dark one. Only tokens prefixed "color-" (plus the "shadow-" elevations
// below) are considered: spacing, radii and font tokens (e.g. "space-md",
// "radius-md", "font-size-lg") are theme-agnostic by convention and must be
// kept unchanged even if their name happens to contain a word like "text" or
// "border" (e.g. a hypothetical "text-indent" spacing token). A site can
// override any key explicitly via tokensDark; this only fills the gaps so the
// toggle is never a no-op.
// Order matters: "surface-alt" must be checked before the plain
// surface/background pattern, and "muted" before "text", since each also
// contains the shorter word.
function deriveDarkValue(name: string, lightValue: string): string {
  if (name.startsWith('shadow-')) {
    return DARK_SHADOWS[name.slice('shadow-'.length)] ?? lightValue;
  }
  if (!name.startsWith('color-')) {
    return lightValue;
  }
  const role = name.slice('color-'.length);
  if (/surface-alt/.test(role)) {
    return DARK_SURFACE_ALT_NEUTRAL;
  }
  if (/(surface|background)/.test(role)) {
    return DARK_SURFACE_NEUTRAL;
  }
  if (/muted/.test(role)) {
    return DARK_TEXT_MUTED_NEUTRAL;
  }
  if (/text/.test(role)) {
    return DARK_TEXT_NEUTRAL;
  }
  if (/border/.test(role)) {
    return DARK_BORDER_NEUTRAL;
  }
  if (/(danger|error)/.test(role)) {
    return DARK_DANGER;
  }
  return lightValue;
}

// Names are sorted so the output is deterministic: jsonb does not preserve
// insertion order.
//
// Three blocks are emitted (spec 06 dark-mode amendment):
//   1. the light tokens on :root;
//   2. the dark tokens for an explicit dark choice. Two selectors carry it: the
//      persisted [data-nv-theme='dark'] attribute the runtime stamps on the
//      document before first paint, and the legacy
//      :has(#nv-theme-toggle:checked) form, kept so a header block that was
//      seeded with the checkbox control keeps working without a re-seed;
//   3. the dark tokens under prefers-color-scheme, excluding an explicit
//      'light' choice, so a visitor whose OS is dark gets a dark first paint
//      even with JavaScript disabled.
//
// The Page Studio canvas rewrites ':root' onto its own surface class, so the
// attribute selectors resolve against the canvas element there and the same
// stylesheet drives editing, preview and production.
const DARK_SELECTORS = [
  ":root[data-nv-theme='dark']",
  '.nv-site-root:has(#nv-theme-toggle:checked)',
].join(',\n');

export function renderTokensCss(
  tokens: Record<string, string>,
  tokensDark?: Record<string, string> | null,
): string {
  const names = Object.keys(tokens).sort((a, b) => a.localeCompare(b));
  if (names.length === 0) {
    return ':root {\n}\n';
  }
  const lightLines = names.map((name) => `  --nv-${name}: ${tokens[name]};`);
  const darkLines = names.map((name) => {
    const value = tokensDark?.[name] ?? deriveDarkValue(name, tokens[name] as string);
    return `  --nv-${name}: ${value};`;
  });
  const dark = darkLines.join('\n');
  // Indented one level for the media query copy.
  const darkIndented = darkLines.map((line) => `  ${line}`).join('\n');
  return (
    `:root {\n${lightLines.join('\n')}\n}\n` +
    `${DARK_SELECTORS} {\n${dark}\n}\n` +
    '@media (prefers-color-scheme: dark) {\n' +
    `  :root:not([data-nv-theme='light']) {\n${darkIndented}\n  }\n` +
    '}\n'
  );
}
