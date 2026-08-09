'use client';

import { Box, Text } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../../../lib/api-url';
import { RenderTree } from '../../../lib/renderer/render-tree';
import { type EditorNode, stateToTree } from './editor-state';
import type { Block } from './types';

const SCOPE_CLASS = 'nv-page-preview';

// Client-side live preview of the editor state, rendered through the same
// block registry the public runtime uses. The site's design tokens are
// fetched from the public style endpoint and scoped to this container; if
// the endpoint is not available yet, blocks fall back to their defaults.
export function PagePreview({
  nodes,
  blocks,
  siteSlug,
}: {
  nodes: EditorNode[];
  blocks: Block[];
  siteSlug: string | null;
}) {
  const [css, setCss] = useState('');

  useEffect(() => {
    if (siteSlug === null || siteSlug === '') {
      return;
    }
    let cancelled = false;
    fetch(apiUrl(`/public/sites/${siteSlug}/style.css`))
      .then((response) => (response.ok ? response.text() : ''))
      .then((text) => {
        if (!cancelled) {
          setCss(text);
        }
      })
      .catch(() => {
        // No style endpoint yet: preview without site tokens.
      });
    return () => {
      cancelled = true;
    };
  }, [siteSlug]);

  // The stylesheet declares tokens on :root; rewrite them onto the preview
  // container so they do not leak into the admin UI.
  const scopedCss = useMemo(() => css.replaceAll(':root', `.${SCOPE_CLASS}`), [css]);
  const tree = useMemo(() => stateToTree(nodes), [nodes]);
  const blockInfo = useMemo(
    () =>
      Object.fromEntries(
        blocks.map((block) => [block.externalReferenceCode, { name: block.name }]),
      ),
    [blocks],
  );

  return (
    <Box>
      <Text size="xs" c="slate.4" mb="xs">
        This is how the page looks with your current, unsaved changes. Some blocks may render
        slightly differently on the live site.
      </Text>
      <Box
        className={SCOPE_CLASS}
        style={{
          border: '1px solid var(--mantine-color-slate-2)',
          borderRadius: 'var(--mantine-radius-lg)',
          background: 'white',
          overflow: 'hidden',
        }}
      >
        {scopedCss !== '' ? <style>{scopedCss}</style> : null}
        {tree.blocks.length === 0 ? (
          <Text size="sm" c="slate.4" ta="center" py="xl">
            Nothing to preview yet. Add blocks in the Blocks tab first.
          </Text>
        ) : (
          <RenderTree tree={tree} blockInfo={blockInfo} />
        )}
      </Box>
    </Box>
  );
}
