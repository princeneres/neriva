'use client';

import { Box } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../../lib/api';
import { BlockForm } from '../block-form';
import {
  type Block,
  BLOCK_DRAFT_STORAGE_KEY,
  type BlockDraft,
  type BlockPayload,
  parseBlockDraft,
} from '../types';

export default function NewBlockPage() {
  const router = useRouter();
  // The "Duplicate" action on a built-in block leaves pre-fill values in
  // sessionStorage. Read after mount (undefined = not read yet) so server
  // and first client render agree.
  const [draft, setDraft] = useState<BlockDraft | null | undefined>(undefined);

  useEffect(() => {
    const parsed = parseBlockDraft(sessionStorage.getItem(BLOCK_DRAFT_STORAGE_KEY));
    sessionStorage.removeItem(BLOCK_DRAFT_STORAGE_KEY);
    setDraft(parsed);
  }, []);

  async function createBlock(payload: BlockPayload): Promise<Block> {
    const { data } = await api.post<{ data: Block }>('/blocks', payload);
    router.replace(`/admin/blocks/${data.id}`);
    return data;
  }

  return (
    <Box maw={1600}>
      {draft === undefined ? null : (
        <BlockForm initial={draft ?? undefined} onSubmit={createBlock} />
      )}
    </Box>
  );
}
