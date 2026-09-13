'use client';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { theme } from '../lib/theme';

// Mantine belongs to the admin, not to the whole app. Mounting the providers
// and their stylesheet in the root layout meant every published page shipped
// the modal manager, the toast machinery and Mantine's full component CSS to
// anonymous visitors who never open a modal or see a notification. Route-level
// global CSS imports are already used this way in this repo (the media screen
// imports the dropzone stylesheet), so the two imports above land in a chunk
// only the routes below pull in.
//
// The mono face lives here for the same reason: --font-mono is referenced only
// by admin screens (block and style book editors, the studio's code inputs),
// but declaring it on <html> made every public page preload ~31 KB of a font
// it never paints.
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

// The document background: globals.css keeps `body` on the neutral tokens so a
// published page is never tinted by admin chrome, so the Mantine-driven body
// colors are applied here instead, over the admin surface only.
export function AdminProviders({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <ModalsProvider>
        <Notifications position="bottom-right" />
        <div
          className={mono.variable}
          style={{
            minHeight: '100vh',
            background: 'var(--mantine-color-body)',
            color: 'var(--mantine-color-text)',
          }}
        >
          {children}
        </div>
      </ModalsProvider>
    </MantineProvider>
  );
}
