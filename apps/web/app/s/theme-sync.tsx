'use client';

import { useEffect } from 'react';
import {
  resolveTheme,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
  type SiteTheme,
} from '../../lib/theme-script';

function currentTheme(): SiteTheme {
  return document.documentElement.getAttribute(THEME_ATTRIBUTE) === 'dark' ? 'dark' : 'light';
}

function apply(theme: SiteTheme, persist: boolean): void {
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage blocked (private mode, cookie settings): the choice still
      // applies to this page view, it just will not outlive it.
    }
  }
  // Keep the seeded header control, a hidden checkbox, showing the truth. It is
  // the input the block template ships today, so the theme must round-trip
  // through it rather than replace it.
  const box = document.getElementById('nv-theme-toggle');
  if (box instanceof HTMLInputElement && box.checked !== (theme === 'dark')) {
    box.checked = theme === 'dark';
  }
  for (const el of document.querySelectorAll('[data-nv-theme-toggle]')) {
    el.setAttribute('aria-pressed', String(theme === 'dark'));
  }
}

// Owns the site's light/dark state for published pages (spec 06 dark-mode
// amendment). Renders nothing: the visible control is a block template's own
// markup, which is sanitized data and so cannot carry a script of its own.
//
// The theme itself is already correct before this mounts, stamped on <html> by
// the inline script in app/layout.tsx. This only makes the control interactive
// and the choice durable.
export function ThemeSync() {
  useEffect(() => {
    apply(currentTheme(), false);

    function onChange(event: Event) {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.id === 'nv-theme-toggle') {
        apply(target.checked ? 'dark' : 'light', true);
      }
    }

    function onClick(event: Event) {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (target.closest('[data-nv-theme-toggle]')) {
        apply(currentTheme() === 'dark' ? 'light' : 'dark', true);
      }
    }

    document.addEventListener('change', onChange);
    document.addEventListener('click', onClick);

    // Follow the OS while the visitor has expressed no preference of their own.
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    function onMedia() {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(THEME_STORAGE_KEY);
      } catch {
        // treated as no preference
      }
      if (stored !== 'dark' && stored !== 'light') {
        apply(resolveTheme(null, media.matches), false);
      }
    }
    media.addEventListener('change', onMedia);

    return () => {
      document.removeEventListener('change', onChange);
      document.removeEventListener('click', onClick);
      media.removeEventListener('change', onMedia);
    };
  }, []);

  return null;
}
