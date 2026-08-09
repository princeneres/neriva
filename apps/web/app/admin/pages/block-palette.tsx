'use client';

import { useDraggable } from '@dnd-kit/core';
import {
  Badge,
  Box,
  Card,
  Group,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconGripVertical, IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import type { Block } from './types';

export const PALETTE_ID_PREFIX = 'palette:';

// A compact, always-visible list of blocks next to the canvas. Items can be
// dragged into the canvas (insert at drop position) or clicked to append.
export function BlockPalette({
  blocks,
  loading,
  onAdd,
}: {
  blocks: Block[];
  loading: boolean;
  onAdd: (block: Block) => void;
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
    <Card padding="sm" w={250} style={{ alignSelf: 'flex-start', flexShrink: 0 }}>
      <Text size="xs" fw={700} tt="uppercase" c="slate.5" lts="0.05em" mb={6}>
        Blocks
      </Text>
      <Text size="xs" c="slate.4" mb="xs">
        Drag a block onto the page, or click it to add it at the end.
      </Text>
      <TextInput
        size="xs"
        placeholder="Search blocks"
        leftSection={<IconSearch size={13} />}
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        mb="xs"
        aria-label="Search blocks"
      />
      {loading ? (
        <Stack gap={6}>
          <Skeleton height={34} radius="md" />
          <Skeleton height={34} radius="md" />
          <Skeleton height={34} radius="md" />
        </Stack>
      ) : filtered.length === 0 ? (
        <Text size="xs" c="slate.4" py="sm" ta="center">
          {blocks.length === 0
            ? 'No blocks yet. Create some in the Blocks section first.'
            : 'No blocks match your search.'}
        </Text>
      ) : (
        <ScrollArea.Autosize mah={420} type="auto">
          <Stack gap={6}>
            {filtered.map((block) => (
              <PaletteItem key={block.id} block={block} onAdd={onAdd} />
            ))}
          </Stack>
        </ScrollArea.Autosize>
      )}
    </Card>
  );
}

function PaletteItem({ block, onAdd }: { block: Block; onAdd: (block: Block) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${PALETTE_ID_PREFIX}${block.externalReferenceCode}`,
    data: { blockErc: block.externalReferenceCode },
  });

  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onAdd(block)}
      p={6}
      style={{
        border: '1px solid var(--mantine-color-slate-2)',
        borderRadius: 'var(--mantine-radius-md)',
        cursor: 'grab',
        background: 'white',
        opacity: isDragging ? 0.4 : 1,
        touchAction: 'none',
      }}
      aria-label={`Add block ${block.name}`}
    >
      <Group gap={6} wrap="nowrap">
        <IconGripVertical
          size={14}
          color="var(--mantine-color-slate-4)"
          style={{ flexShrink: 0 }}
        />
        <Text size="sm" fw={500} truncate style={{ flex: 1 }}>
          {block.name}
        </Text>
        {block.category !== null && block.category !== '' ? (
          <Badge color="slate" variant="outline" size="xs">
            {block.category}
          </Badge>
        ) : null}
      </Group>
    </Box>
  );
}
