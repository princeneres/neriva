'use client';

import {
  Badge,
  Card,
  Group,
  Modal,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { IconCube, IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { type Block, statusColor } from './types';

// Searchable picker used by every "Add block" button in the canvas.
export function BlockPickerModal({
  opened,
  onClose,
  blocks,
  loading,
  onPick,
}: {
  opened: boolean;
  onClose: () => void;
  blocks: Block[];
  loading: boolean;
  onPick: (block: Block) => void;
}) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const filtered =
    needle === ''
      ? blocks
      : blocks.filter((block) =>
          [block.name, block.externalReferenceCode, block.category ?? ''].some((text) =>
            text.toLowerCase().includes(needle),
          ),
        );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Add a block"
      size="lg"
      onExitTransitionEnd={() => setQuery('')}
    >
      <TextInput
        placeholder="Search blocks by name or category"
        leftSection={<IconSearch size={16} />}
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        mb="md"
        data-autofocus
      />
      {loading ? (
        <Stack gap="sm">
          <Skeleton height={72} radius="lg" />
          <Skeleton height={72} radius="lg" />
          <Skeleton height={72} radius="lg" />
        </Stack>
      ) : filtered.length === 0 ? (
        <Stack align="center" gap="sm" py="xl">
          <ThemeIcon size={40} radius="xl" variant="light">
            <IconCube size={20} stroke={1.6} />
          </ThemeIcon>
          <Text size="sm" c="slate.5" ta="center" maw={360}>
            {blocks.length === 0
              ? 'No blocks yet. Blocks are the pieces pages are made of; create some in the Blocks section first.'
              : 'No blocks match your search.'}
          </Text>
        </Stack>
      ) : (
        <ScrollArea.Autosize mah={420} type="auto">
          <Stack gap="sm">
            {filtered.map((block) => (
              <Card
                key={block.id}
                padding="md"
                onClick={() => onPick(block)}
                style={{ cursor: 'pointer' }}
              >
                <Group justify="space-between" wrap="nowrap" mb={2}>
                  <Group gap="xs" wrap="nowrap" miw={0}>
                    <Text fw={600} truncate>
                      {block.name}
                    </Text>
                    {block.category !== null && block.category !== '' ? (
                      <Badge color="slate" variant="outline">
                        {block.category}
                      </Badge>
                    ) : null}
                  </Group>
                  <Badge color={statusColor(block.status)}>{block.status}</Badge>
                </Group>
                {block.description !== null && block.description !== '' ? (
                  <Text size="sm" c="slate.5" lineClamp={2}>
                    {block.description}
                  </Text>
                ) : null}
                <Text size="xs" c="slate.4" mt={4}>
                  {block.slots.length > 0
                    ? `Has spaces for nested blocks: ${block.slots.map((slot) => slot.name).join(', ')}`
                    : 'Does not nest other blocks'}
                </Text>
              </Card>
            ))}
          </Stack>
        </ScrollArea.Autosize>
      )}
    </Modal>
  );
}
