'use client';

import { createTheme, type MantineColorsTuple } from '@mantine/core';

// Brand scale built around --nv-color-primary #cc3d47 (index 6).
const neriva: MantineColorsTuple = [
  '#fdf2f3',
  '#f8dee0',
  '#f0bcc0',
  '#e7969d',
  '#dc6f79',
  '#d4525d',
  '#cc3d47',
  '#b02f39',
  '#93262f',
  '#771e26',
];

// Warm near-neutrals: the app background is paper, not screen-gray.
const slate: MantineColorsTuple = [
  '#faf9f7',
  '#f2f0ec',
  '#e6e3dd',
  '#d4d0c8',
  '#a8a49b',
  '#7c7870',
  '#5c5850',
  '#403d37',
  '#2b2925',
  '#1a1917',
];

export const theme = createTheme({
  primaryColor: 'neriva',
  primaryShade: 6,
  colors: { neriva, slate },
  fontFamily: 'var(--font-body), sans-serif',
  fontFamilyMonospace: 'var(--font-mono), monospace',
  headings: {
    fontFamily: 'var(--font-display), sans-serif',
    fontWeight: '650',
    sizes: {
      h1: { lineHeight: '1.15' },
      h2: { lineHeight: '1.2' },
    },
  },
  defaultRadius: 'md',
  cursorType: 'pointer',
  components: {
    Button: { defaultProps: { fw: 600 } },
    Card: {
      defaultProps: { withBorder: true, radius: 'lg', shadow: 'none' },
    },
    Tooltip: {
      defaultProps: { withArrow: true, multiline: true, maw: 280, openDelay: 150 },
    },
    Badge: { defaultProps: { radius: 'sm', variant: 'light' } },
  },
});
