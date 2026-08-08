import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './globals.css';
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import type { Metadata } from 'next';
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { theme } from '../lib/theme';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
});
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body' });
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'Neriva',
  description: 'Lightweight, headless-first CMS',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
      </head>
      <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
        <MantineProvider theme={theme}>
          <ModalsProvider>
            <Notifications position="bottom-right" />
            {children}
          </ModalsProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
