'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Select,
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
import { IconRestore, IconTrash, IconTrashX } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { useCursorList } from '../../../components/data-table';
import { HelpTip } from '../../../components/help-tip';
import { ApiError, api, type PublicUser } from '../../../lib/api';
import {
  TRASH_ENTITY_TYPES,
  TRASH_HELP,
  trashIconFor,
  trashTypeLabel,
  type TrashItem,
} from './types';

// Resolved emails live for the browser session: the same user id repeats
// across many trash rows and rarely changes mid-session.
const userEmailCache = new Map<string, string | null>();

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}

function DeletedByCell({ userId }: { userId: string | null }) {
  const [email, setEmail] = useState<string | null | undefined>(
    userId === null ? null : userEmailCache.get(userId),
  );

  useEffect(() => {
    if (userId === null || userEmailCache.has(userId)) {
      return;
    }
    let active = true;
    api
      .get<{ data: PublicUser }>(`/users/${userId}`)
      .then(({ data }) => {
        userEmailCache.set(userId, data.email);
        if (active) {
          setEmail(data.email);
        }
      })
      .catch(() => {
        // Best-effort lookup: the user may be gone (404) or unreachable.
        // Either way, fall back to the placeholder and cache the miss.
        userEmailCache.set(userId, null);
        if (active) {
          setEmail(null);
        }
      });
    return () => {
      active = false;
    };
  }, [userId]);

  if (userId === null) {
    return <Text c="slate.5">—</Text>;
  }
  if (email === undefined) {
    return <Skeleton height={12} width={140} />;
  }
  return <Text c="slate.5">{email ?? '—'}</Text>;
}

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2].map((row) => (
        <Table.Tr key={row}>
          {[0, 1, 2, 3, 4].map((cell) => (
            <Table.Td key={cell}>
              <Skeleton height={14} radius="sm" />
            </Table.Td>
          ))}
        </Table.Tr>
      ))}
    </>
  );
}

export default function TrashPage() {
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const listPath = useMemo(
    () => (typeFilter ? `/trash?type=${encodeURIComponent(typeFilter)}` : '/trash'),
    [typeFilter],
  );

  const { items, loading, hasMore, refresh, loadMore } = useCursorList<TrashItem>(
    listPath,
    (error) =>
      notifications.show({ color: 'red', title: 'Could not load trash', message: error.message }),
  );

  async function restore(item: TrashItem) {
    try {
      await api.post(`/trash/${item.id}/restore`);
      notifications.show({
        color: 'green',
        title: 'Item restored',
        message: `"${item.displayName}" was restored.`,
      });
      await refresh();
    } catch (error) {
      // A 409 (naming conflict at the origin table) lands here; the item
      // must stay in the list untouched so the user can retry after fixing
      // the conflict, so no refresh happens on this path.
      notifications.show({
        color: 'red',
        title: 'Could not restore',
        message: errorMessage(error),
      });
    }
  }

  function confirmDeleteForever(item: TrashItem) {
    modals.openConfirmModal({
      title: 'Delete forever',
      children: (
        <Text size="sm">
          Permanently delete <strong>{item.displayName}</strong>? This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete forever', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        void (async () => {
          try {
            await api.del(`/trash/${item.id}`);
            notifications.show({
              color: 'green',
              title: 'Item deleted',
              message: `"${item.displayName}" was permanently deleted.`,
            });
            await refresh();
          } catch (error) {
            notifications.show({
              color: 'red',
              title: 'Could not delete',
              message: errorMessage(error),
            });
          }
        })();
      },
    });
  }

  function confirmEmptyTrash() {
    const count = items.length;
    modals.openConfirmModal({
      title: 'Empty trash',
      children: (
        <Text size="sm">
          {count} item{count === 1 ? '' : 's'} currently loaded. Emptying the trash permanently
          deletes everything in it for this tenant, including items not loaded here. This cannot be
          undone.
        </Text>
      ),
      labels: { confirm: 'Empty trash', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        void (async () => {
          try {
            await api.del('/trash');
            notifications.show({
              color: 'green',
              title: 'Trash emptied',
              message: 'All items were permanently deleted.',
            });
            await refresh();
          } catch (error) {
            notifications.show({
              color: 'red',
              title: 'Could not empty trash',
              message: errorMessage(error),
            });
          }
        })();
      },
    });
  }

  const showEmpty = !loading && items.length === 0;

  return (
    <>
      <Group justify="space-between" mb="lg">
        <div>
          <Group gap={6}>
            <Title order={1} fz="h2">
              Trash
            </Title>
            <HelpTip label={TRASH_HELP} />
          </Group>
          <Text c="slate.5">
            Deleted items are kept here until you restore them or delete them for good.
          </Text>
        </div>
        <Button
          color="red"
          variant="light"
          leftSection={<IconTrashX size={16} />}
          disabled={items.length === 0}
          onClick={confirmEmptyTrash}
        >
          Empty trash
        </Button>
      </Group>

      <Group mb="md">
        <Select
          aria-label="Filter by type"
          placeholder="All types"
          data={TRASH_ENTITY_TYPES.map((entry) => ({ value: entry.value, label: entry.label }))}
          value={typeFilter}
          onChange={setTypeFilter}
          clearable
          w={220}
        />
      </Group>

      <Card padding={0}>
        {showEmpty ? (
          <Center py={64}>
            <Stack align="center" gap="sm" maw={460}>
              <ThemeIcon variant="light" size={48} radius="xl">
                <IconTrash size={24} stroke={1.6} />
              </ThemeIcon>
              <Text ta="center" c="slate.5">
                Deleted pages, blocks and other content stay here until you restore or permanently
                delete them. Sites are the only exception: deleting a site removes everything in it
                immediately.
              </Text>
            </Stack>
          </Center>
        ) : (
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Item</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Deleted</Table.Th>
                <Table.Th>
                  Deleted by
                  <HelpTip label="The user who deleted this item, resolved from their id" />
                </Table.Th>
                <Table.Th aria-label="Actions" />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {loading && items.length === 0 ? (
                <SkeletonRows />
              ) : (
                items.map((item) => {
                  const Icon = trashIconFor(item.entityType);
                  return (
                    <Table.Tr key={item.id}>
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          <ThemeIcon size={28} radius="sm" variant="light">
                            <Icon size={16} stroke={1.7} />
                          </ThemeIcon>
                          <Text fw={600} truncate>
                            {item.displayName}
                          </Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Badge color="gray" variant="light">
                          {trashTypeLabel(item.entityType)}
                        </Badge>
                      </Table.Td>
                      <Table.Td c="slate.5">{new Date(item.deletedAt).toLocaleString()}</Table.Td>
                      <Table.Td>
                        <DeletedByCell userId={item.deletedBy} />
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} justify="flex-end" wrap="nowrap">
                          <Tooltip label="Restore">
                            <ActionIcon
                              variant="subtle"
                              aria-label={`Restore ${item.displayName}`}
                              onClick={() => void restore(item)}
                            >
                              <IconRestore size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete forever">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              aria-label={`Delete ${item.displayName} forever`}
                              onClick={() => confirmDeleteForever(item)}
                            >
                              <IconTrashX size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })
              )}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {hasMore ? (
        <Center mt="md">
          <Button variant="light" disabled={loading} onClick={() => void loadMore()}>
            {loading ? 'Loading…' : 'Load more'}
          </Button>
        </Center>
      ) : null}
    </>
  );
}
