'use client';

import { Box, Group, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
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

  async function createBlock(payload: BlockPayload) {
    const { data } = await api.post<{ data: Block }>('/blocks', payload);
    notifications.show({ color: 'green', message: `Block "${data.name}" created` });
    router.push('/admin/blocks');
  }

  return (
    <Box maw={1240}>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={1} fz="h2">
            New block
          </Title>
          <Text c="slate.5">
            Name the block, define the fields editors will fill in, and add slots if other blocks
            can nest inside it.
          </Text>
        </div>
      </Group>
      {draft === undefined ? null : (
        <BlockForm initial={draft ?? undefined} onSubmit={createBlock} />
      )}
    </Box>
  );
}
