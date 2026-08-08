'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Skeleton,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconCube, IconPencil, IconPlus, IconTrash, IconWorldUpload } from '@tabler/icons-react';
import Link from 'next/link';
import { HelpTip } from '../../../components/help-tip';
import { useCursorList } from '../../../components/data-table';
import { ApiError, api } from '../../../lib/api';
import type { Block } from './types';

const STATUS_COLORS: Record<Block['status'], string> = {
  DRAFT: 'gray',
  PUBLISHED: 'green',
  ARCHIVED: 'dark',
};

const CATEGORY_COLORS: Record<string, string> = {
  layout: 'indigo',
  content: 'teal',
  media: 'grape',
  navigation: 'orange',
};

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}

export default function BlocksPage() {
  const { items, loading, hasMore, refresh, loadMore } = useCursorList<Block>('/blocks', (error) =>
    notifications.show({ color: 'red', message: error.message }),
  );

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
        <Button component={Link} href="/admin/blocks/new" leftSection={<IconPlus size={16} />}>
          New block
        </Button>
      </Group>

      <Card padding={0}>
        {showEmptyState ? (
          <Stack align="center" gap="xs" py={56} px="md">
            <ThemeIcon size={44} radius="md" variant="light">
              <IconCube size={24} stroke={1.7} />
            </ThemeIcon>
            <Text fw={600} mt={4}>
              No blocks yet
            </Text>
            <Text size="sm" c="slate.5" ta="center" maw={420}>
              Blocks are the reusable pieces pages are made of, like Liferay fragments. Define one
              here and every page can use it.
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
        ) : (
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th>
                  Status
                  <HelpTip label="Only published blocks can appear on published pages" />
                </Table.Th>
                <Table.Th>
                  Slots
                  <HelpTip label="Spaces inside the block where other blocks can be nested" />
                </Table.Th>
                <Table.Th>Updated</Table.Th>
                <Table.Th aria-label="Actions" />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {loading && items.length === 0
                ? [0, 1, 2].map((row) => (
                    <Table.Tr key={row}>
                      {[0, 1, 2, 3, 4, 5].map((cell) => (
                        <Table.Td key={cell}>
                          <Skeleton height={12} />
                        </Table.Td>
                      ))}
                    </Table.Tr>
                  ))
                : items.map((block) => (
                    <Table.Tr key={block.id}>
                      <Table.Td>
                        <Text size="sm" fw={600}>
                          {block.name}
                        </Text>
                        {block.description ? (
                          <Text size="xs" c="slate.5" lineClamp={1}>
                            {block.description}
                          </Text>
                        ) : null}
                      </Table.Td>
                      <Table.Td>
                        {block.category ? (
                          <Badge color={CATEGORY_COLORS[block.category] ?? 'slate'}>
                            {block.category}
                          </Badge>
                        ) : (
                          <Text size="sm" c="slate.4">
                            None
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Badge color={STATUS_COLORS[block.status]}>{block.status}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{block.slots.length}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="slate.5">
                          {new Date(block.updatedAt).toLocaleString()}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} justify="flex-end" wrap="nowrap">
                          {block.status !== 'PUBLISHED' ? (
                            <Tooltip label="Publish">
                              <ActionIcon
                                variant="subtle"
                                aria-label={`Publish ${block.name}`}
                                onClick={() => confirmPublish(block)}
                              >
                                <IconWorldUpload size={16} />
                              </ActionIcon>
                            </Tooltip>
                          ) : null}
                          <Tooltip label="Edit">
                            <ActionIcon
                              variant="subtle"
                              component={Link}
                              href={`/admin/blocks/${block.id}`}
                              aria-label={`Edit ${block.name}`}
                            >
                              <IconPencil size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              aria-label={`Delete ${block.name}`}
                              onClick={() => confirmDelete(block)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {hasMore ? (
        <Group justify="center" mt="md">
          <Button variant="light" loading={loading} onClick={() => void loadMore()}>
            Load more
          </Button>
        </Group>
      ) : null}
    </div>
  );
}
