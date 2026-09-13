import { describe, expect, it } from 'vitest';
import { renderTokensCss } from './style-tokens';

describe('renderTokensCss', () => {
  it('renders tokens as --nv- prefixed custom properties on :root', () => {
    const css = renderTokensCss({ 'color-primary': '#cc3d47', 'space-4': '1rem' });
    expect(css).toContain(':root {\n  --nv-color-primary: #cc3d47;\n  --nv-space-4: 1rem;\n}\n');
  });

  it('sorts token names for deterministic output', () => {
    const css = renderTokensCss({ 'space-4': '1rem', 'color-primary': '#cc3d47' });
    expect(css.split('\n').slice(0, 3)).toEqual([
      ':root {',
      '  --nv-color-primary: #cc3d47;',
      '  --nv-space-4: 1rem;',
    ]);
  });

  it('renders an empty map as an empty :root block with no dark section', () => {
    expect(renderTokensCss({})).toBe(':root {\n}\n');
  });

  it('derives a dark counterpart for surface/text tokens and keeps everything else', () => {
    const css = renderTokensCss({
      'color-primary': '#cc3d47',
      'color-surface': '#faf9f7',
      'color-text': '#1a1917',
      'space-4': '1rem',
    });
    expect(css).toContain(
      ":root[data-nv-theme='dark'],\n.nv-site-root:has(#nv-theme-toggle:checked) {\n" +
        '  --nv-color-primary: #cc3d47;\n' +
        '  --nv-color-surface: #18181b;\n' +
        '  --nv-color-text: #f4f3f1;\n' +
        '  --nv-space-4: 1rem;\n' +
        '}\n',
    );
  });

  it('an explicit tokensDark entry wins over the derived value', () => {
    const css = renderTokensCss({ 'color-surface': '#faf9f7' }, { 'color-surface': '#0b0b0b' });
    expect(css).toContain('--nv-color-surface: #0b0b0b;');
    expect(css).not.toContain('--nv-color-surface: #18181b;');
  });

  it('derives a distinct value for surface-alt, not the plain surface neutral', () => {
    const css = renderTokensCss({ 'color-surface': '#faf9f7', 'color-surface-alt': '#f1efec' });
    expect(css).toContain('--nv-color-surface-alt: #232327;');
    expect(css).toContain('--nv-color-surface: #18181b;');
  });

  it('derives a translucent light border for a dark border token', () => {
    const css = renderTokensCss({ 'color-border': '#e5e3df' });
    expect(css).toContain('--nv-color-border: rgba(255, 255, 255, 0.12);');
  });

  it('never derives a dark value for a token that is not color-prefixed, even if its name contains a role word', () => {
    // Regression: deriveDarkValue previously matched "surface"/"text"/"border"
    // as unanchored substrings anywhere in the name, so a plausible
    // non-color token like "border-width" or "text-indent" would have its
    // light value silently replaced by an unrelated dark neutral.
    const css = renderTokensCss({
      'border-width': '2px',
      'text-indent': '1rem',
      'background-position': 'center',
    });
    expect(css).toContain(
      ":root[data-nv-theme='dark'],\n.nv-site-root:has(#nv-theme-toggle:checked) {\n" +
        '  --nv-background-position: center;\n' +
        '  --nv-border-width: 2px;\n' +
        '  --nv-text-indent: 1rem;\n' +
        '}\n',
    );
  });

  it('still derives correctly for a color token whose role word is a substring of its suffix', () => {
    const css = renderTokensCss({ 'color-border': '#e5e3df', 'color-text': '#1a1917' });
    expect(css).toContain('--nv-color-border: rgba(255, 255, 255, 0.12);');
    expect(css).toContain('--nv-color-text: #f4f3f1;');
  });

  it('emits the dark tokens for the persisted attribute as well as the legacy checkbox selector', () => {
    const css = renderTokensCss({ 'color-surface': '#faf9f7' });
    // The attribute is what the runtime stamps before first paint; the
    // :has() form is kept so a header block seeded with the checkbox control
    // keeps working without a re-seed.
    expect(css).toContain(
      ":root[data-nv-theme='dark'],\n.nv-site-root:has(#nv-theme-toggle:checked) {",
    );
  });

  it('repeats the dark tokens under prefers-color-scheme, excluding an explicit light choice', () => {
    const css = renderTokensCss({ 'color-surface': '#faf9f7' });
    expect(css).toContain(
      '@media (prefers-color-scheme: dark) {\n' +
        "  :root:not([data-nv-theme='light']) {\n" +
        '    --nv-color-surface: #18181b;\n' +
        '  }\n' +
        '}\n',
    );
  });

  it('emits no dark blocks at all for an empty token map', () => {
    const css = renderTokensCss({});
    expect(css).not.toContain('data-nv-theme');
    expect(css).not.toContain('prefers-color-scheme');
  });
});
