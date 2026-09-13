'use client';

import { useDraggable } from '@dnd-kit/core';
import {
  ActionIcon,
  Badge,
  Box,
  Group,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconGripVertical,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconSearch,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { blockIconFor } from '../../../components/block-icon';
import { HelpTip } from '../../../components/help-tip';
import classes from './studio.module.css';
import type { Block } from './types';

export const PALETTE_ID_PREFIX = 'palette:';
const OTHER_CATEGORY = 'Other';

// Left panel of the studio: searchable blocks grouped by category. Clicking
// a block appends it to the end of the page; dragging drops it at a root
// position. Collapses to a slim rail.
export function StudioPalette({
  blocks,
  loading,
  collapsed,
  onToggleCollapsed,
  onAdd,
}: {
  blocks: Block[];
  loading: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onAdd: (block: Block) => void;
}) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      needle === ''
        ? blocks
        : blocks.filter((block) =>
            [block.name, block.externalReferenceCode, block.category ?? ''].some((text) =>
              text.toLowerCase().includes(needle),
            ),
          ),
    [blocks, needle],
  );

  // Grouped case-insensitively so native blocks (lowercase categories like
  // "layout") share a group with user blocks whose category only differs in
  // casing; the label shows capitalized.
  const groups = useMemo(() => {
    const map = new Map<string, Block[]>();
    for (const block of filtered) {
      const category =
        block.category === null || block.category.trim() === ''
          ? OTHER_CATEGORY
          : block.category.trim().toLowerCase();
      map.set(category, [...(map.get(category) ?? []), block]);
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === OTHER_CATEGORY) return 1;
      if (b === OTHER_CATEGORY) return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  if (collapsed) {
    return (
      <div className={classes.paletteRail}>
        <Tooltip label="Show the block palette" position="right">
          <ActionIcon
            variant="subtle"
            color="slate"
            onClick={onToggleCollapsed}
            aria-label="Show the block palette"
          >
            <IconLayoutSidebarLeftExpand size={18} />
          </ActionIcon>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className={classes.palette}>
      <Box px="sm" pt="sm">
        <Group justify="space-between" wrap="nowrap" mb={4}>
          <Text size="xs" fw={700} tt="uppercase" c="slate.5" lts="0.05em">
            Blocks
            <HelpTip label="Blocks are the reusable pieces pages are made of. Click one to add it to the end of the page, or drag it where you want it." />
          </Text>
          <Tooltip label="Hide the block palette">
            <ActionIcon
              variant="subtle"
              color="slate"
              size="sm"
              onClick={onToggleCollapsed}
              aria-label="Hide the block palette"
            >
              <IconLayoutSidebarLeftCollapse size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <TextInput
          size="xs"
          placeholder="Search blocks"
          leftSection={<IconSearch size={13} />}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          mb="xs"
          aria-label="Search blocks"
        />
      </Box>
      <ScrollArea type="auto" style={{ flex: 1 }} px="sm" pb="sm">
        {loading ? (
          <Stack gap={6}>
            <Skeleton height={44} radius="md" />
            <Skeleton height={44} radius="md" />
            <Skeleton height={44} radius="md" />
          </Stack>
        ) : filtered.length === 0 ? (
          <Text size="xs" c="slate.5" py="sm" ta="center">
            {blocks.length === 0
              ? 'No blocks yet. Create some in the Blocks section first.'
              : 'No blocks match your search.'}
          </Text>
        ) : (
          <Stack gap="sm">
            {groups.map(([category, items]) => (
              <Box key={category}>
                <Text size="xs" fw={700} tt="uppercase" c="slate.5" lts="0.05em" mb={4}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </Text>
                <Stack gap={6}>
                  {items.map((block) => (
                    <PaletteItem key={block.id} block={block} onAdd={onAdd} />
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </ScrollArea>
    </div>
  );
}

function PaletteItem({ block, onAdd }: { block: Block; onAdd: (block: Block) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${PALETTE_ID_PREFIX}${block.externalReferenceCode}`,
    data: { blockErc: block.externalReferenceCode },
  });
  const BlockIcon = blockIconFor(block.externalReferenceCode, block.category);

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
        <ThemeIcon variant="light" size="sm" radius="sm" style={{ flexShrink: 0 }}>
          <BlockIcon size={14} stroke={1.7} />
        </ThemeIcon>
        <Box miw={0} style={{ flex: 1 }}>
          <Text size="sm" fw={500} truncate>
            {block.name}
          </Text>
          <Group gap={6} wrap="nowrap">
            {block.category !== null && block.category !== '' ? (
              <Badge color="slate" variant="outline" size="xs">
                {block.category}
              </Badge>
            ) : null}
            <Text size="xs" c="slate.5">
              {block.slots.length === 0
                ? 'No slots'
                : `${block.slots.length} slot${block.slots.length === 1 ? '' : 's'}`}
            </Text>
          </Group>
        </Box>
      </Group>
    </Box>
  );
}
