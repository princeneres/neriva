'use client';

import type { components } from '@neriva/contracts';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Center,
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
import { IconPalette, IconPencil, IconPlus, IconRocket, IconTrash } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCursorList } from '../../../components/data-table';
import { HelpTip } from '../../../components/help-tip';
import { ApiError, api } from '../../../lib/api';

type StyleBook = components['schemas']['StyleBookDto'];

const STATUS_COLORS: Record<StyleBook['status'], string> = {
  DRAFT: 'gray',
  PUBLISHED: 'green',
  ARCHIVED: 'dark',
};

function notifyError(error: unknown, fallback: string) {
  notifications.show({
    color: 'red',
    message: error instanceof ApiError ? error.message : fallback,
  });
}

export default function StyleBookListPage() {
  const router = useRouter();
  const { items, loading, hasMore, refresh, loadMore } = useCursorList<StyleBook>(
    '/style-books',
    (error) => notifyError(error, 'Failed to load style books'),
  );

  function confirmPublish(row: StyleBook) {
    modals.openConfirmModal({
      title: 'Publish style book',
      children: (
        <Text size="sm">
          Publishing makes &quot;{row.name}&quot; the version sites use. Its version number
          increases from {row.version} to {row.version + 1} so you can always tell which set of
          tokens is live.
        </Text>
      ),
      labels: { confirm: 'Publish', cancel: 'Cancel' },
      onConfirm: () => {
        void (async () => {
          try {
            await api.post(`/style-books/${row.id}/publish`);
            notifications.show({ color: 'green', message: `"${row.name}" published` });
            await refresh();
          } catch (error) {
            notifyError(error, 'Failed to publish style book');
          }
        })();
      },
    });
  }

  function confirmDelete(row: StyleBook) {
    modals.openConfirmModal({
      title: 'Delete style book',
      children: (
        <Text size="sm">
          Delete &quot;{row.name}&quot; and all of its tokens? Pages that reference these tokens
          will fall back to the defaults. This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        void (async () => {
          try {
            await api.del(`/style-books/${row.id}`);
            notifications.show({ color: 'green', message: `"${row.name}" deleted` });
            await refresh();
          } catch (error) {
            notifyError(error, 'Failed to delete style book');
          }
        })();
      },
    });
  }

  const showEmptyState = !loading && items.length === 0;
  const showSkeleton = loading && items.length === 0;

  return (
    <>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={1} fz="h2">
            Style Book
          </Title>
          <Text c="slate.5">
            Your design decisions as named tokens: change a color here, every page follows.
          </Text>
        </div>
        <Button component={Link} href="/admin/style-book/new" leftSection={<IconPlus size={16} />}>
          New style book
        </Button>
      </Group>

      <Card padding={0}>
        {showEmptyState ? (
          <Stack align="center" py={64} px="md" gap="sm">
            <ThemeIcon variant="light" size={48} radius="xl">
              <IconPalette size={26} stroke={1.6} />
            </ThemeIcon>
            <Text fw={600}>No style books yet</Text>
            <Text size="sm" c="slate.5" ta="center" maw={440}>
              A style book collects your colors, spacing and typography as named tokens. Blocks
              reference the token names, so restyling the whole site means editing one list.
            </Text>
            <Button
              component={Link}
              href="/admin/style-book/new"
              leftSection={<IconPlus size={16} />}
              mt="xs"
            >
              Create your first style book
            </Button>
          </Stack>
        ) : (
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>
                  Version
                  <HelpTip label="Goes up by one every time you publish, so you can tell which set of tokens is live." />
                </Table.Th>
                <Table.Th>
                  Tokens
                  <HelpTip label="Design decisions with a name: blocks reference the name, you change the value in one place." />
                </Table.Th>
                <Table.Th>Updated</Table.Th>
                <Table.Th aria-label="Actions" />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {showSkeleton
                ? [0, 1, 2].map((index) => (
                    <Table.Tr key={index}>
                      {[0, 1, 2, 3, 4, 5].map((cell) => (
                        <Table.Td key={cell}>
                          <Skeleton height={14} />
                        </Table.Td>
                      ))}
                    </Table.Tr>
                  ))
                : items.map((row) => (
                    <Table.Tr key={row.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {row.name}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={STATUS_COLORS[row.status]}>{row.status}</Badge>
                      </Table.Td>
                      <Table.Td>{row.version}</Table.Td>
                      <Table.Td>{Object.keys(row.tokens).length}</Table.Td>
                      <Table.Td>{new Date(row.updatedAt).toLocaleString()}</Table.Td>
                      <Table.Td>
                        <Group gap={4} justify="flex-end" wrap="nowrap">
                          <Tooltip label="Publish this version">
                            <ActionIcon
                              variant="subtle"
                              aria-label="Publish"
                              onClick={() => confirmPublish(row)}
                            >
                              <IconRocket size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Edit">
                            <ActionIcon
                              variant="subtle"
                              aria-label="Edit"
                              onClick={() => router.push(`/admin/style-book/${row.id}`)}
                            >
                              <IconPencil size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              aria-label="Delete"
                              onClick={() => confirmDelete(row)}
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
        <Center mt="md">
          <Button variant="light" loading={loading} onClick={() => void loadMore()}>
            Load more
          </Button>
        </Center>
      ) : null}
    </>
  );
}
