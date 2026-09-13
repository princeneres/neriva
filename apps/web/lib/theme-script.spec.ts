import { describe, expect, it } from 'vitest';
import {
  resolveTheme,
  THEME_ATTRIBUTE,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from './theme-script';

describe('resolveTheme', () => {
  it('honours an explicit stored choice over the OS preference', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('falls back to the OS preference when nothing is stored', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme(null, false)).toBe('light');
  });

  it('treats a corrupt stored value as no preference', () => {
    expect(resolveTheme('DARK', true)).toBe('dark');
    expect(resolveTheme('', true)).toBe('dark');
    expect(resolveTheme('purple', false)).toBe('light');
  });
});

describe('THEME_INIT_SCRIPT', () => {
  it('references the same key and attribute the runtime uses', () => {
    expect(THEME_INIT_SCRIPT).toContain(THEME_STORAGE_KEY);
    expect(THEME_INIT_SCRIPT).toContain(THEME_ATTRIBUTE);
  });

  it('always sets the attribute, so no page can be left unthemed', () => {
    const html: { attr: string | null } = { attr: null };
    const run = (stored: string | null, prefersDark: boolean) => {
      html.attr = null;
      const scope = {
        localStorage: {
          getItem: (key: string) => (key === THEME_STORAGE_KEY ? stored : null),
        },
        matchMedia: (query: string) => ({ matches: query.includes('dark') && prefersDark }),
        document: {
          documentElement: {
            setAttribute: (name: string, value: string) => {
              if (name === THEME_ATTRIBUTE) {
                html.attr = value;
              }
            },
          },
        },
      };
      new Function('window', 'document', 'localStorage', THEME_INIT_SCRIPT)(
        scope,
        scope.document,
        scope.localStorage,
      );
      return html.attr;
    };

    expect(run('dark', false)).toBe('dark');
    expect(run('light', true)).toBe('light');
    expect(run(null, true)).toBe('dark');
    expect(run(null, false)).toBe('light');
  });

  it('survives storage being unavailable and still themes from the OS', () => {
    let attr: string | null = null;
    const scope = {
      localStorage: {
        getItem: () => {
          throw new Error('SecurityError: storage blocked');
        },
      },
      matchMedia: () => ({ matches: true }),
      document: {
        documentElement: {
          setAttribute: (name: string, value: string) => {
            if (name === THEME_ATTRIBUTE) {
              attr = value;
            }
          },
        },
      },
    };
    expect(() =>
      new Function('window', 'document', 'localStorage', THEME_INIT_SCRIPT)(
        scope,
        scope.document,
        scope.localStorage,
      ),
    ).not.toThrow();
    expect(attr).toBe('dark');
  });
});
