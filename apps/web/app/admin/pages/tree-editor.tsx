'use client';

import { useEffect, useState } from 'react';
import { Button } from '../../../components/form';
import { useToast } from '../../../components/toast';
import { ApiError, api } from '../../../lib/api';
import { insertBlock } from './tree-utils';
import type { Block } from './types';

// Structured JSON editor for the page tree: a textarea with the tree as
// pretty-printed JSON next to a helper panel of available blocks.
export function TreeEditor({
  value,
  onChange,
  error,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  error: string | null;
  disabled: boolean;
}) {
  const toast = useToast();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(true);
  const [blocksError, setBlocksError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: Block[] }>('/blocks?limit=100')
      .then(({ data }) => setBlocks(data))
      .catch((err: unknown) => {
        setBlocksError(err instanceof ApiError ? err.message : 'Failed to load blocks');
      })
      .finally(() => setBlocksLoading(false));
  }, []);

  function onInsert(erc: string) {
    const result = insertBlock(value, erc);
    if (result.ok) {
      onChange(result.text);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 'var(--nv-space-4)',
        alignItems: 'start',
      }}
    >
      <div>
        <textarea
          aria-label="Page tree JSON"
          rows={20}
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          style={{ fontFamily: 'monospace', fontSize: 'var(--nv-text-sm)', width: '100%' }}
        />
        {error ? (
          <div className="nv-error" style={{ marginTop: 'var(--nv-space-2)' }}>
            {error}
          </div>
        ) : null}
      </div>
      <div className="nv-card">
        <div className="nv-card-body">
          <h2 style={{ margin: 0, fontSize: 'var(--nv-text-md)' }}>Available blocks</h2>
          {blocksError ? <div className="nv-error">{blocksError}</div> : null}
          {blocksLoading ? <div className="nv-empty">Loading blocks…</div> : null}
          {!blocksLoading && !blocksError && blocks.length === 0 ? (
            <div className="nv-empty">No blocks defined yet.</div>
          ) : null}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--nv-space-3)',
              marginTop: 'var(--nv-space-3)',
            }}
          >
            {blocks.map((block) => (
              <div
                key={block.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 'var(--nv-space-3)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--nv-space-2)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <strong>{block.name}</strong>
                    <span className="nv-code">{block.externalReferenceCode}</span>
                    <span className="nv-badge" data-status={block.status}>
                      {block.status}
                    </span>
                  </div>
                  <div
                    style={{ fontSize: 'var(--nv-text-sm)', color: 'var(--nv-color-neutral-600)' }}
                  >
                    {block.slots.length > 0
                      ? `Slots: ${block.slots.map((slot) => slot.name).join(', ')}`
                      : 'No slots'}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={disabled}
                  onClick={() => onInsert(block.externalReferenceCode)}
                >
                  Insert
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
