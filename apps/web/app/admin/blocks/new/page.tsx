'use client';

import { Box, Group, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { BlockForm } from '../block-form';
import type { Block, BlockPayload } from '../types';

export default function NewBlockPage() {
  const router = useRouter();

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
      <BlockForm onSubmit={createBlock} />
    </Box>
  );
}
