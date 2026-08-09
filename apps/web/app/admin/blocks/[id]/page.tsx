'use client';

import { Alert, Box, Button, Card, Code, Group, Skeleton, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle } from '@tabler/icons-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError, api } from '../../../../lib/api';
import { BlockForm } from '../block-form';
import type { Block, BlockPayload } from '../types';

export default function EditBlockPage() {
  const router = useRouter();
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

  async function updateBlock(payload: BlockPayload) {
    const { data } = await api.patch<{ data: Block }>(`/blocks/${id}`, payload);
    notifications.show({ color: 'green', message: `Block "${data.name}" saved` });
    router.push('/admin/blocks');
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
    <Box maw={1240}>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={1} fz="h2">
            Edit block
          </Title>
          <Text c="slate.5">
            Changes apply to every page that uses this block the next time it renders.
          </Text>
        </div>
      </Group>

      <Card padding="md" mb="md" bg="slate.0">
        <Group gap="xl" wrap="wrap">
          <div>
            <Text size="xs" c="slate.5" fw={600} tt="uppercase" lts="0.04em">
              Reference code
            </Text>
            <Code>{block.externalReferenceCode}</Code>
          </div>
          <div>
            <Text size="xs" c="slate.5" fw={600} tt="uppercase" lts="0.04em">
              Id
            </Text>
            <Code>{block.id}</Code>
          </div>
          <div>
            <Text size="xs" c="slate.5" fw={600} tt="uppercase" lts="0.04em">
              Created
            </Text>
            <Text size="sm">{new Date(block.createdAt).toLocaleString()}</Text>
          </div>
        </Group>
      </Card>

      <BlockForm block={block} onSubmit={updateBlock} />
    </Box>
  );
}
