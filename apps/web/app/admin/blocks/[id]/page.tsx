'use client';

import { Alert, Box, Button, Card, Skeleton, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError, api } from '../../../../lib/api';
import { BlockForm } from '../block-form';
import type { Block, BlockPayload } from '../types';

export default function EditBlockPage() {
  const { id } = useParams<{ id: string }>();
  const [block, setBlock] = useState<Block | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: Block }>(`/blocks/${id}`)
      .then(({ data }) => setBlock(data))
      .catch((error: unknown) => {
        setLoadError(error instanceof ApiError ? error.message : 'The block could not be loaded.');
      });
  }, [id]);

  async function updateBlock(payload: BlockPayload): Promise<Block> {
    const { data } = await api.patch<{ data: Block }>(`/blocks/${id}`, payload);
    setBlock(data);
    return data;
  }

  async function restoreNativeTemplate(): Promise<Block> {
    const { data } = await api.post<{ data: Block }>(`/blocks/${id}/restore-native-template`);
    setBlock(data);
    return data;
  }

  if (loadError) {
    return (
      <Box maw={760}>
        <Alert color="red" icon={<IconAlertTriangle size={16} />} title="Block not available">
          <Text size="sm" mb="sm">
            {loadError}
          </Text>
          <Button component={Link} href="/admin/blocks" variant="light" color="red" size="xs">
            Back to blocks
          </Button>
        </Alert>
      </Box>
    );
  }

  if (!block) {
    return (
      <Box maw={760}>
        <Skeleton height={32} width={280} mb="sm" />
        <Skeleton height={16} width={420} mb="lg" />
        <Card padding="xl">
          <Skeleton height={36} mb="md" />
          <Skeleton height={36} mb="md" />
          <Skeleton height={72} />
        </Card>
      </Box>
    );
  }

  return (
    <Box maw={1600}>
      <BlockForm block={block} onSubmit={updateBlock} onRestoreNative={restoreNativeTemplate} />
    </Box>
  );
}
