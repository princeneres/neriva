import './globals.css';
import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { THEME_INIT_SCRIPT } from '../lib/theme-script';

export const metadata: Metadata = {
  title: 'Neriva',
  description: 'Lightweight, headless-first CMS',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" {...mantineHtmlProps}>
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
