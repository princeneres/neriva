import type { CSSProperties, ReactNode } from 'react';

// A block renderer receives the node's props and its rendered slot children.
// Components must be server-safe (no hooks): the public route renders them
// on the server; the admin previews render them on the client.
export interface BlockRenderProps {
  props: Record<string, unknown>;
  slots: Record<string, ReactNode>;
  blockName: string;
}

export type BlockRenderer = (renderProps: BlockRenderProps) => ReactNode;

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

function Hero({ props }: BlockRenderProps) {
  const cta = text(props.ctaLabel);
  return (
    <section
      style={{
        background: 'var(--nv-color-text, #1a1917)',
        color: 'var(--nv-color-surface, #faf9f7)',
        padding: 'calc(var(--nv-space-lg, 2rem) * 2) var(--nv-space-lg, 2rem)',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '2.4rem', margin: 0, lineHeight: 1.15 }}>{text(props.heading)}</h1>
      {text(props.subheading) ? (
        <p style={{ opacity: 0.75, maxWidth: 560, margin: '1rem auto 0' }}>
          {text(props.subheading)}
        </p>
      ) : null}
      {cta ? (
        <a
          href={text(props.ctaUrl) || '#'}
          style={{
            display: 'inline-block',
            marginTop: '1.5rem',
            background: 'var(--nv-color-primary, #cc3d47)',
            color: '#fff',
            padding: '0.6rem 1.4rem',
            borderRadius: 'var(--nv-radius-md, 8px)',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          {cta}
        </a>
      ) : null}
    </section>
  );
}

function RichText({ props }: BlockRenderProps) {
  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: 'var(--nv-space-md, 1rem)' }}>
      {text(props.body)
        .split(/\n{2,}/)
        .filter(Boolean)
        .map((paragraph, i) => (
          <p key={i} style={{ lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
            {paragraph}
          </p>
        ))}
    </div>
  );
}

function TwoColumns({ slots }: BlockRenderProps) {
  const column: CSSProperties = { flex: 1, minWidth: 260 };
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--nv-space-lg, 2rem)',
        maxWidth: 960,
        margin: '0 auto',
        padding: 'var(--nv-space-md, 1rem)',
      }}
    >
      <div style={column}>{slots.left}</div>
      <div style={column}>{slots.right}</div>
    </div>
  );
}

function ImageBlock({ props }: BlockRenderProps) {
  const url = text(props.url);
  if (!url) {
    return null;
  }
  return (
    <figure style={{ maxWidth: 960, margin: '0 auto', padding: 'var(--nv-space-md, 1rem)' }}>
      {/* Arbitrary CMS-authored URLs: next/image would require remote-pattern config */}
      <img
        src={url}
        alt={text(props.alt)}
        style={{ width: '100%', borderRadius: 'var(--nv-radius-md, 8px)', display: 'block' }}
      />
    </figure>
  );
}

// Fallback for blocks without a dedicated renderer: heuristics over the
// props keep custom blocks visible instead of invisible.
function GenericBlock({ props, slots, blockName }: BlockRenderProps) {
  const entries = Object.entries(props);
  const headingEntry = entries.find(([key]) => /^(heading|title)$/i.test(key));
  const imageEntry = entries.find(
    ([key, value]) => /(image|img)/i.test(key) && typeof value === 'string',
  );
  const paragraphs = entries.filter(
    ([key, value]) =>
      typeof value === 'string' && key !== headingEntry?.[0] && key !== imageEntry?.[0],
  );
  return (
    <section style={{ maxWidth: 680, margin: '0 auto', padding: 'var(--nv-space-md, 1rem)' }}>
      {headingEntry ? <h2 style={{ marginTop: 0 }}>{text(headingEntry[1])}</h2> : null}
      {imageEntry ? (
        <img
          src={text(imageEntry[1])}
          alt={blockName}
          style={{ maxWidth: '100%', borderRadius: 8 }}
        />
      ) : null}
      {paragraphs.map(([key, value]) => (
        <p key={key} style={{ lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
          {text(value)}
        </p>
      ))}
      {Object.entries(slots).map(([name, children]) => (
        <div key={name}>{children}</div>
      ))}
    </section>
  );
}

const RENDERERS: Record<string, BlockRenderer> = {
  hero: Hero,
  'rich-text': RichText,
  'two-columns': TwoColumns,
  image: ImageBlock,
};

export function rendererFor(erc: string): BlockRenderer {
  return RENDERERS[erc] ?? GenericBlock;
}
