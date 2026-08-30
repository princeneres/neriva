// The site's Style Book stylesheet declares its tokens on :root and its dark
// variants on :root[data-nv-theme='dark'] and inside a prefers-color-scheme
// block (see apps/api/src/common/style-tokens.ts). Injected as-is into an admin
// screen, every one of those selectors matches the admin's own <html>: the site
// tokens leak into the surrounding chrome, and on a dark OS the dark block wins
// and repaints the editor.
//
// Rewriting :root onto the surface element keeps all three blocks working while
// confining them to the page being edited. The surface must also carry an
// explicit data-nv-theme, since the prefers-color-scheme rule is written as
// :not([data-nv-theme='light']).
export const SITE_CSS_SCOPE_CLASS = 'nv-studio-canvas';

export function scopeSiteCss(css: string, scopeClass = SITE_CSS_SCOPE_CLASS): string {
  return css.replaceAll(':root', `.${scopeClass}`);
}
