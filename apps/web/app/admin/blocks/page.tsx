'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Menu,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconCube,
  IconDots,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
  IconWorldUpload,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';
import { blockIconFor } from '../../../components/block-icon';
import { useCursorList } from '../../../components/data-table';
import { ApiError, api } from '../../../lib/api';
import classes from './blocks-gallery.module.css';
import type { Block } from './types';

const STATUS_COLORS: Record<Block['status'], string> = {
  DRAFT: 'gray',
  PUBLISHED: 'green',
  ARCHIVED: 'dark',
};

// Liferay-style fragment library ordering; unknown categories follow
// alphabetically, uncategorized blocks close the gallery under "Other".
const CATEGORY_ORDER = ['layout', 'basic', 'content', 'media', 'advanced'];
const UNCATEGORIZED_KEY = 'other';
const ALL_CATEGORIES = 'all';

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}

function categoryKey(block: Block): string {
  const raw = (block.category ?? '').trim().toLowerCase();
  return raw === '' ? UNCATEGORIZED_KEY : raw;
}

function categoryLabel(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function groupRank(key: string): number {
  if (key === UNCATEGORIZED_KEY) {
    return CATEGORY_ORDER.length + 1;
  }
  const index = CATEGORY_ORDER.indexOf(key);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

interface BlockGroup {
  key: string;
  label: string;
  blocks: Block[];
}

function groupByCategory(blocks: Block[]): BlockGroup[] {
  const groups = new Map<string, Block[]>();
  for (const block of blocks) {
    const key = categoryKey(block);
    const list = groups.get(key);
    if (list) {
      list.push(block);
    } else {
      groups.set(key, [block]);
    }
  }
  return [...groups.entries()]
    .sort(([a], [b]) => groupRank(a) - groupRank(b) || a.localeCompare(b))
    .map(([key, list]) => ({
      key,
      label: categoryLabel(key),
      blocks: [...list].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      ),
    }));
}

export default function BlocksPage() {
  const { items, loading, hasMore, refresh, loadMore } = useCursorList<Block>('/blocks', (error) =>
    notifications.show({ color: 'red', message: error.message }),
  );
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);

  function confirmPublish(block: Block) {
    modals.openConfirmModal({
      title: 'Publish block',
      children: (
        <Text size="sm">
          Publish &quot;{block.name}&quot;? Published blocks can be used on published pages.
        </Text>
      ),
      labels: { confirm: 'Publish', cancel: 'Cancel' },
      onConfirm: () => {
        void (async () => {
          try {
            await api.post(`/blocks/${block.id}/publish`);
            notifications.show({ color: 'green', message: `Block "${block.name}" published` });
            void refresh();
          } catch (error) {
            notifications.show({ color: 'red', message: errorMessage(error) });
          }
        })();
      },
    });
  }

  function confirmDelete(block: Block) {
    modals.openConfirmModal({
      title: 'Delete block',
      children: (
        <Text size="sm">
          Delete &quot;{block.name}&quot;? Pages that use this block will lose it. This cannot be
          undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        void (async () => {
          try {
            await api.del(`/blocks/${block.id}`);
            notifications.show({ color: 'green', message: `Block "${block.name}" deleted` });
            void refresh();
          } catch (error) {
            notifications.show({ color: 'red', message: errorMessage(error) });
          }
        })();
      },
    });
  }

  const showEmptyState = !loading && items.length === 0;

  const categoryOptions = [
    { value: ALL_CATEGORIES, label: 'All categories' },
    ...[...new Set(items.map((block) => categoryKey(block)))]
      .sort((a, b) => groupRank(a) - groupRank(b) || a.localeCompare(b))
      .map((key) => ({ value: key, label: categoryLabel(key) })),
  ];

  const query = search.trim().toLowerCase();
  const visible = items.filter((block) => {
    if (category !== ALL_CATEGORIES && categoryKey(block) !== category) {
      return false;
    }
    if (query === '') {
      return true;
    }
    return (
      block.name.toLowerCase().includes(query) ||
      (block.description ?? '').toLowerCase().includes(query) ||
      block.externalReferenceCode.toLowerCase().includes(query)
    );
  });
  const groups = groupByCategory(visible);

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={1} fz="h2">
            Blocks
          </Title>
          <Text c="slate.5">
            Blocks are the reusable pieces pages are made of. Each block declares which fields
            editors can fill in.
          </Text>
        </div>
      </Group>

      {showEmptyState ? (
        <Card>
          <Stack align="center" gap="xs" py={56} px="md">
            <ThemeIcon size={44} radius="md" variant="light">
              <IconCube size={24} stroke={1.7} />
            </ThemeIcon>
            <Text fw={600} mt={4}>
              No blocks yet
            </Text>
            <Text size="sm" c="slate.5" ta="center" maw={420}>
              Blocks are the reusable pieces pages are made of, like Liferay fragments. Define one
              here and it appears in this gallery, ready for every page.
            </Text>
            <Button
              component={Link}
              href="/admin/blocks/new"
              leftSection={<IconPlus size={16} />}
              mt="sm"
            >
              Create your first block
            </Button>
          </Stack>
        </Card>
      ) : (
        <>
          <Group justify="space-between" mb="lg" gap="sm">
            <Group gap="sm">
              <TextInput
                placeholder="Search blocks"
                aria-label="Search blocks"
                leftSection={<IconSearch size={16} />}
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                w={260}
              />
              <Select
                aria-label="Filter by category"
                data={categoryOptions}
                value={category}
                onChange={(value) => setCategory(value ?? ALL_CATEGORIES)}
                allowDeselect={false}
                w={190}
              />
            </Group>
            <Button component={Link} href="/admin/blocks/new" leftSection={<IconPlus size={16} />}>
              New block
            </Button>
          </Group>

          {loading && items.length === 0 ? (
            <SimpleGrid cols={{ base: 2, md: 3, lg: 4 }}>
              {[0, 1, 2, 3].map((tile) => (
                <Skeleton key={tile} height={168} radius="md" />
              ))}
            </SimpleGrid>
          ) : groups.length === 0 ? (
            <Card>
              <Text size="sm" c="slate.5" ta="center" py="xl">
                No blocks match your search.
              </Text>
            </Card>
          ) : (
            <Stack gap="xl">
              {groups.map((group) => (
                <section key={group.key} aria-label={group.label}>
                  <Text size="xs" fw={600} c="slate.5" tt="uppercase" lts={0.5} mb="xs">
                    {group.label}
                  </Text>
                  <SimpleGrid cols={{ base: 2, md: 3, lg: 4 }}>
                    {group.blocks.map((block) => {
                      const Icon = blockIconFor(block.externalReferenceCode, block.category);
                      return (
                        <Card key={block.id} withBorder padding="md" className={classes.card}>
                          <Card.Section bg="slate.0" py="lg">
                            <Center>
                              <ThemeIcon size={44} radius="md" variant="light">
                                <Icon size={24} stroke={1.7} />
                              </ThemeIcon>
                            </Center>
                          </Card.Section>
                          <Text
                            component={Link}
                            href={`/admin/blocks/${block.id}`}
                            className={classes.nameLink}
                            fw={600}
                            size="sm"
                            mt="sm"
                            truncate
                          >
                            {block.name}
                          </Text>
                          <Text size="xs" c="slate.5" lineClamp={1}>
                            {/* nbsp keeps the row height when there is no description */}
                            {block.description ?? ' '}
                          </Text>
                          <Group gap={4} mt="xs">
                            <Badge size="xs" color={STATUS_COLORS[block.status]}>
                              {block.status}
                            </Badge>
                            {block.html ? (
                              <Badge size="xs" variant="light" color="slate" tt="none">
                                Code
                              </Badge>
                            ) : null}
                          </Group>
                          <Menu position="bottom-end" withinPortal>
                            <Menu.Target>
                              <ActionIcon
                                variant="subtle"
                                color="slate"
                                className={classes.menu}
                                aria-label={`Actions for ${block.name}`}
                              >
                                <IconDots size={16} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item
                                component={Link}
                                href={`/admin/blocks/${block.id}`}
                                leftSection={<IconPencil size={14} />}
                              >
                                Edit
                              </Menu.Item>
                              {block.status !== 'PUBLISHED' ? (
                                <Menu.Item
                                  leftSection={<IconWorldUpload size={14} />}
                                  onClick={() => confirmPublish(block)}
                                >
                                  Publish
                                </Menu.Item>
                              ) : null}
                              <Menu.Item
                                color="red"
                                leftSection={<IconTrash size={14} />}
                                onClick={() => confirmDelete(block)}
                              >
                                Delete
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </Card>
                      );
                    })}
                  </SimpleGrid>
                </section>
              ))}
            </Stack>
          )}

          {hasMore ? (
            <Stack align="center" gap={4} mt="lg">
              <Button variant="light" loading={loading} onClick={() => void loadMore()}>
                Load more
              </Button>
              <Text size="xs" c="slate.5">
                More blocks exist on the server. Search and filters only cover the blocks loaded so
                far.
              </Text>
            </Stack>
          ) : null}
        </>
      )}
    </div>
  );
}
