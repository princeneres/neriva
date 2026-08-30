import './globals.css';
import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { THEME_INIT_SCRIPT } from '../lib/theme-script';

// Single minimalist family: Inter for headings and body (user preference),
// with tighter tracking on display sizes handled by the Mantine theme.
// --font-display is an alias of the same face (see globals.css) rather than a
// second next/font instance, which only emitted duplicate @font-face CSS.
const body = Inter({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'Neriva',
  description: 'Lightweight, headless-first CMS',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      {...mantineHtmlProps}
      // Font variables must live on <html>: Mantine's --mantine-font-family
      // is declared at :root and var() inside it resolves there.
      className={body.variable}
    >
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
        {/* Resolves the site's light/dark choice into data-nv-theme before
            first paint, so a dark visitor never sees a white flash. Separate
            from Mantine's scheme on purpose: this one is the Style Book token
            layer for published pages, Mantine's is the admin chrome. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
