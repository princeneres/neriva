'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

interface SandboxMessage {
  channel?: unknown;
  action?: unknown;
  payload?: unknown;
}

function escapeScriptSource(source: string): string {
  return source.replace(/<\/script/gi, '<\\/script');
}

function serializeProps(props: Record<string, unknown>): string {
  // JSON is embedded in a script element. Escaping these characters keeps a
  // prop value from terminating it or creating a second executable context.
  const serialized = JSON.stringify(props) ?? '{}';
  return serialized
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function bridgeSource(props: Record<string, unknown>): string {
  return [
    'window.Neriva=Object.freeze({',
    `props:Object.freeze(${serializeProps(props)}),`,
    "request:(request)=>parent.postMessage({channel:'neriva.block',action:'runtime:request',payload:request},'*')",
    '});',
  ].join('');
}

function sandboxDocument({
  erc,
  html,
  css,
  js,
  props,
}: {
  erc: string;
  html: string;
  css: string;
  js: string;
  props: Record<string, unknown>;
}): string {
  // The Block source is isolated from the parent page: opaque origin,
  // no network, no storage, no top-level navigation and no same-origin
  // permission. The only escape hatch is postMessage, validated by the host.
  return [
    '<!doctype html><html><head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; base-uri 'none'; connect-src 'none'; img-src data: http: https:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'none'\">",
    '<style>html,body{margin:0;min-height:100%;}*{box-sizing:border-box;}</style>',
    css === '' ? '' : `<style>${css}</style>`,
    '</head><body>',
    `<div data-nv-b="${erc.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">${html}</div>`,
    `<script>${bridgeSource(props)}</script>`,
    `<script>${escapeScriptSource(js)}</script>`,
    `<script>const notifySize=()=>parent.postMessage({channel:'neriva.block',action:'frame:resize',payload:{height:Math.ceil(document.documentElement.scrollHeight)}},'*');new ResizeObserver(notifySize).observe(document.documentElement);addEventListener('load',notifySize);notifySize();</script>`,
    '</body></html>',
  ].join('');
}

// Real block JavaScript runs only in this sandbox. The parent receives action
// intents through Neriva.request(), never arbitrary code or network requests,
// and decides whether the active declarative runtime may fulfil them.
export function BlockScriptSandbox({
  erc,
  html,
  css,
  js,
  props = {},
  onAction,
}: {
  erc: string;
  html: string;
  css: string;
  js: string;
  props?: Record<string, unknown>;
  onAction?: (action: string, payload: unknown) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(180);
  const srcDoc = useMemo(
    () => sandboxDocument({ erc, html, css, js, props }),
    [css, erc, html, js, props],
  );

  useEffect(() => {
    function receive(event: MessageEvent<unknown>) {
      if (
        event.source !== frame.current?.contentWindow ||
        typeof event.data !== 'object' ||
        event.data === null
      )
        return;
      const message = event.data as SandboxMessage;
      if (message.channel !== 'neriva.block' || typeof message.action !== 'string') return;
      if (message.action === 'frame:resize') {
        const candidate =
          typeof message.payload === 'object' && message.payload !== null
            ? (message.payload as { height?: unknown }).height
            : undefined;
        if (typeof candidate === 'number' && Number.isFinite(candidate)) {
          setHeight(Math.max(96, Math.min(2400, candidate)));
        }
        return;
      }
      onAction?.(message.action, message.payload);
    }
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [onAction]);

  return (
    <iframe
      ref={frame}
      title={`${erc} interactive Block`}
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      style={{ display: 'block', width: '100%', height, border: 0 }}
    />
  );
}
