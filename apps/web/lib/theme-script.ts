// Site light/dark theme (spec 06, dark-mode amendment).
//
// The theme is a persisted attribute on <html>, not DOM state of a checkbox
// inside a block template. The checkbox-only mechanism could not survive a
// navigation: every link a block renders is a plain anchor, so each click was a
// full document load that served the box unchecked and reverted the site to
// light. It also could not honour the visitor's OS preference.
//
// Deliberately namespaced away from Mantine, which owns
// data-mantine-color-scheme and the mantine-color-scheme-value key: the two
// scripts touch disjoint names and can run in either order.

export const THEME_STORAGE_KEY = 'neriva.theme';
export const THEME_ATTRIBUTE = 'data-nv-theme';

export type SiteTheme = 'light' | 'dark';

// The value stored under THEME_STORAGE_KEY, or null when the visitor has never
// chosen: null means "follow the OS", which is why an explicit 'light' has to
// be representable and is not the same as no entry at all.
export function resolveTheme(stored: string | null, prefersDark: boolean): SiteTheme {
  if (stored === 'dark' || stored === 'light') {
    return stored;
  }
  return prefersDark ? 'dark' : 'light';
}

// Runs in <head> before first paint. Kept as a string rather than a component
// so it can be inlined without hydration, and small enough that parsing it
// costs nothing. Guarded throughout: a browser with storage blocked, or a
// prerender with no matchMedia, must still paint the light theme rather than
// throw and take the document with it.
export const THEME_INIT_SCRIPT = `(function(){try{var s=null;try{s=localStorage.getItem('${THEME_STORAGE_KEY}')}catch(e){}var d=s==='dark'||(s!=='light'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('${THEME_ATTRIBUTE}',d?'dark':'light')}catch(e){}})();`;
