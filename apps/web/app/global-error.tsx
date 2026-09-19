'use client';

import { useEffect } from 'react';
import { BoltMark } from '../components/logo';

// Last line of defence: this replaces the root layout itself, so the document
// shell, the fonts and the colours all have to come from here. No Mantine, no
// global stylesheet, no design tokens: whatever broke may well be one of them.
// Dark mode comes from the OS preference, since the script that resolves the
// site theme lived in the layout this screen is replacing.

const CSS = `
  :root { color-scheme: light dark; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1rem;
    background: #ffffff;
    color: #18181b;
    font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  .nv-ge-panel { max-width: 32rem; text-align: center; }
  .nv-ge-title { margin: 1rem 0 0; font-size: 1.5rem; font-weight: 650; letter-spacing: -0.02em; }
  .nv-ge-text { margin: 0.75rem 0 0; font-size: 1rem; line-height: 1.6; color: #71717a; }
  .nv-ge-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; margin-top: 1.5rem; }
  .nv-ge-btn {
    display: inline-flex; align-items: center; justify-content: center;
    min-height: 2.5rem; padding: 0 1.5rem; border-radius: 8px;
    border: 1px solid transparent; font: inherit; font-size: 0.875rem; font-weight: 600;
    cursor: pointer; text-decoration: none;
  }
  .nv-ge-primary { background: #cc3d47; color: #ffffff; }
  .nv-ge-primary:hover { background: #b53540; }
  .nv-ge-ghost { background: transparent; border-color: #e4e4e7; color: inherit; }
  .nv-ge-ref { margin: 1.25rem 0 0; font-size: 0.75rem; color: #71717a; }
  .nv-ge-ref code {
    padding: 0.15em 0.45em; border-radius: 4px; border: 1px solid #e4e4e7;
    background: #fafafa; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #18181b; color: #ffffff; }
    .nv-ge-text, .nv-ge-ref { color: #a1a1aa; }
    .nv-ge-ghost { border-color: #3f3f46; }
    .nv-ge-ref code { border-color: #3f3f46; background: #27272a; }
  }
`;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[neriva] fatal error', error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>Something went wrong</title>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </head>
      <body>
        <main className="nv-ge-panel">
          <BoltMark size={44} />
          <h1 className="nv-ge-title">Something went wrong</h1>
          <p className="nv-ge-text">
            The application could not start this screen. Reloading usually clears it. If it keeps
            happening, please contact whoever runs this site.
          </p>
          <div className="nv-ge-actions">
            <button type="button" className="nv-ge-btn nv-ge-primary" onClick={reset}>
              Try again
            </button>
            <a className="nv-ge-btn nv-ge-ghost" href="/">
              Go to the home page
            </a>
          </div>
          {error.digest ? (
            <p className="nv-ge-ref">
              If you need to report this, quote <code>{error.digest}</code>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
