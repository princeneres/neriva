'use client';

import type { components } from '@neriva/contracts';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '../../../../components/form';
import { useToast } from '../../../../components/toast';
import { ApiError, api } from '../../../../lib/api';
import { apiUrl } from '../../../../lib/api-url';
import { getAccessToken } from '../../../../lib/auth-storage';
import { StyleBookForm, type StyleBookDraft } from '../style-book-form';
import { tokensToRows, type TokenRow } from '../token-rows';

type StyleBook = components['schemas']['StyleBookDto'];

function TokenPreview({ rows }: { rows: TokenRow[] }) {
  const colorRows = rows.filter((row) => row.name.trim().startsWith('color'));
  const otherRows = rows.filter((row) => !row.name.trim().startsWith('color'));

  if (rows.length === 0) {
    return <div className="nv-empty">No tokens to preview.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--nv-space-4)' }}>
      {colorRows.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--nv-space-3)' }}>
          {colorRows.map((row) => (
            <div key={row.id} style={{ width: '96px' }}>
              <div
                style={{
                  height: '48px',
                  borderRadius: 'var(--nv-radius-sm)',
                  border: '1px solid var(--nv-color-neutral-200)',
                  background: row.value,
                }}
              />
              <div
                style={{
                  marginTop: 'var(--nv-space-1)',
                  fontSize: 'var(--nv-text-xs)',
                  color: 'var(--nv-color-neutral-600)',
                  wordBreak: 'break-all',
                }}
              >
                {row.name}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {otherRows.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--nv-space-1)' }}>
          {otherRows.map((row) => (
            <div
              key={row.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 'var(--nv-space-3)',
                fontSize: 'var(--nv-text-sm)',
              }}
            >
              <code>{row.name}</code>
              <span style={{ color: 'var(--nv-color-neutral-600)', wordBreak: 'break-all' }}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function EditStyleBookPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [styleBook, setStyleBook] = useState<StyleBook | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<TokenRow[]>([]);
  const [css, setCss] = useState<string | null>(null);
  const [cssLoading, setCssLoading] = useState(false);

  useEffect(() => {
    api
      .get<{ data: StyleBook }>(`/style-books/${id}`)
      .then(({ data }) => {
        setStyleBook(data);
        setPreviewRows(tokensToRows(data.tokens));
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof ApiError ? error.message : 'Failed to load style book');
      });
  }, [id]);

  async function onSubmit(draft: StyleBookDraft) {
    const { data } = await api.patch<{ data: StyleBook }>(`/style-books/${id}`, draft);
    setStyleBook(data);
    toast.success('Style book saved');
  }

  async function onViewCss() {
    if (css !== null) {
      setCss(null);
      return;
    }
    setCssLoading(true);
    try {
      // The /css endpoint returns text/css, so it bypasses api.get (JSON only).
      const token = getAccessToken();
      const response = await fetch(apiUrl(`/style-books/${id}/css`), {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      setCss(await response.text());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load CSS');
    } finally {
      setCssLoading(false);
    }
  }

  if (loadError) {
    return (
      <>
        <div className="nv-toolbar">
          <h1>Style book</h1>
        </div>
        <div className="nv-error">{loadError}</div>
      </>
    );
  }

  if (!styleBook) {
    return (
      <>
        <div className="nv-toolbar">
          <h1>Style book</h1>
        </div>
        <div className="nv-empty">Loading…</div>
      </>
    );
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1>{styleBook.name}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--nv-space-3)' }}>
          <span className="nv-badge" data-status={styleBook.status}>
            {styleBook.status}
          </span>
          <span style={{ fontSize: 'var(--nv-text-sm)', color: 'var(--nv-color-neutral-600)' }}>
            Version {styleBook.version}
          </span>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 'var(--nv-space-4)',
          alignItems: 'start',
        }}
      >
        <div className="nv-card">
          <div className="nv-card-body">
            <StyleBookForm
              initialName={styleBook.name}
              initialTokens={styleBook.tokens}
              submitLabel="Save"
              onSubmit={onSubmit}
              onRowsChange={setPreviewRows}
            />
          </div>
        </div>
        <div className="nv-card">
          <div className="nv-card-body">
            <div className="nv-toolbar" style={{ marginBottom: 'var(--nv-space-3)' }}>
              <h2 style={{ margin: 0, fontSize: 'var(--nv-text-md)' }}>Preview</h2>
              <Button type="button" variant="secondary" onClick={() => void onViewCss()}>
                {cssLoading ? 'Loading…' : css !== null ? 'Hide CSS' : 'View CSS'}
              </Button>
            </div>
            <TokenPreview rows={previewRows} />
            {css !== null ? (
              <pre
                style={{
                  marginTop: 'var(--nv-space-4)',
                  padding: 'var(--nv-space-3)',
                  background: 'var(--nv-color-neutral-50)',
                  border: '1px solid var(--nv-color-neutral-200)',
                  borderRadius: 'var(--nv-radius-sm)',
                  fontSize: 'var(--nv-text-xs)',
                  overflowX: 'auto',
                }}
              >
                {css}
              </pre>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
