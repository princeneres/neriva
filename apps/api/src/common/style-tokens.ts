// Style Book token CSS rendering (spec 06, dark-mode amendment). Shared
// infrastructure, not a feature module's internals: both the stylebook
// module (its own /css preview) and the delivery module (the public
// /public/sites/:slug/style.css endpoint) render the same Style Book token
// set into CSS and must stay in lockstep, so this lives in common/ rather
// than being duplicated per module.

const DARK_SURFACE_NEUTRAL = '#18181b';
const DARK_SURFACE_ALT_NEUTRAL = '#232327';
const DARK_TEXT_NEUTRAL = '#f4f3f1';
const DARK_BORDER_NEUTRAL = 'rgba(255, 255, 255, 0.12)';

// Best-effort dark counterpart for a token whose name suggests a color
// role: a surface/background gets a dark neutral, text gets a light
// neutral, a border gets a translucent light line instead of a translucent
// dark one. Only tokens prefixed "color-" are considered: spacing, radii
// and font tokens (e.g. "space-md", "radius-md") are theme-agnostic by
// convention and must be kept unchanged even if their name happens to
// contain a word like "text" or "border" (e.g. a hypothetical
// "text-indent" spacing token). A site can override any key explicitly via
// tokensDark; this only fills the gaps so the toggle is never a no-op.
// Order matters: "surface-alt" must be checked before the plain
// surface/background pattern, since it also contains "surface".
function deriveDarkValue(name: string, lightValue: string): string {
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
  if (/text/.test(role)) {
    return DARK_TEXT_NEUTRAL;
  }
  if (/border/.test(role)) {
    return DARK_BORDER_NEUTRAL;
  }
  return lightValue;
}

// Names are sorted so the output is deterministic: jsonb does not preserve
// insertion order. Emits the light tokens on :root and a dark variant gated
// behind :has(#nv-theme-toggle:checked) on the nearest .nv-site-root
// ancestor (spec 06 dark-mode amendment): a header block's toggle checkbox
// is a descendant of that element, and :has() lets the override reach
// upward to it without any script.
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
  return (
    `:root {\n${lightLines.join('\n')}\n}\n` +
    `.nv-site-root:has(#nv-theme-toggle:checked) {\n${darkLines.join('\n')}\n}\n`
  );
}
