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
import {
  IconFilePencil,
  IconLayoutGrid,
  IconPencil,
  IconPlus,
  IconSend,
  IconTrash,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { HelpTip } from '../../../../components/help-tip';
import { useCursorList } from '../../../../components/data-table';
import { ApiError, api, type ListMeta } from '../../../../lib/api';
import { STATUS_COLORS, type ContentEntry, type ContentType } from '../types';

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

export default function ContentEntriesPage() {
  const router = useRouter();
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: ContentType[]; meta: ListMeta }>('/content-types?limit=100')
      .then(({ data }) => setContentTypes(data))
      .catch((err: unknown) => {
        notifications.show({
          color: 'red',
          title: 'Could not load content types',
          message: err instanceof ApiError ? err.message : 'Loading content types failed',
        });
      });
  }, []);

  const typeNames = useMemo(
    () => new Map(contentTypes.map((contentType) => [contentType.id, contentType.name])),
    [contentTypes],
  );

  const listPath = useMemo(
    () =>
      typeFilter
        ? `/content-entries?contentType=${encodeURIComponent(typeFilter)}`
        : '/content-entries',
    [typeFilter],
  );

  const { items, loading, hasMore, refresh, loadMore } = useCursorList<ContentEntry>(
    listPath,
    (error) =>
      notifications.show({
        color: 'red',
        title: 'Could not load entries',
        message: error.message,
      }),
  );

  function confirmDelete(entry: ContentEntry) {
    modals.openConfirmModal({
      title: 'Delete entry',
      children: (
        <Text size="sm">
          Delete the entry <strong>{entry.title}</strong>? This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        void (async () => {
          try {
            await api.del(`/content-entries/${entry.id}`);
            notifications.show({ color: 'green', message: 'Entry deleted' });
            await refresh();
          } catch (error) {
            notifications.show({
              color: 'red',
              title: 'Could not delete entry',
              message: error instanceof ApiError ? error.message : 'Deleting the entry failed',
            });
          }
        })();
      },
    });
  }

  function confirmPublish(entry: ContentEntry) {
    modals.openConfirmModal({
      title: 'Publish entry',
      children: (
        <Text size="sm">
          Publish <strong>{entry.title}</strong>? Published entries are visible to the sites and
          apps that consume this content.
        </Text>
      ),
      labels: { confirm: 'Publish', cancel: 'Cancel' },
      onConfirm: () => {
        void (async () => {
          try {
            await api.post<{ data: ContentEntry }>(`/content-entries/${entry.id}/publish`);
            notifications.show({ color: 'green', message: 'Entry published' });
            await refresh();
          } catch (error) {
            notifications.show({
              color: 'red',
              title: 'Could not publish entry',
              message: error instanceof ApiError ? error.message : 'Publishing the entry failed',
            });
          }
        })();
      },
    });
  }

  const newEntryHref = typeFilter
    ? `/admin/content/entries/new?type=${encodeURIComponent(typeFilter)}`
    : '/admin/content/entries/new';
  const showEmpty = !loading && items.length === 0;

  return (
    <>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={1} fz="h2">
            Content entries
            <HelpTip label="Entries are the actual content: each one fills in the fields of its content type" />
          </Title>
          <Text c="slate.5">
            The content itself. Every entry belongs to a content type and fills in its fields.
          </Text>
        </div>
        <Group gap="sm">
          <Button
            component={Link}
            href="/admin/content"
            variant="default"
            leftSection={<IconLayoutGrid size={16} />}
          >
            Content types
          </Button>
          <Button component={Link} href={newEntryHref} leftSection={<IconPlus size={16} />}>
            New entry
          </Button>
        </Group>
      </Group>

      <Group mb="md">
        <Select
          aria-label="Filter by content type"
          placeholder="All content types"
          data={contentTypes.map((contentType) => ({
            value: contentType.id,
            label: contentType.name,
          }))}
          value={typeFilter}
          onChange={setTypeFilter}
          clearable
          w={260}
        />
      </Group>

      <Card padding={0}>
        {showEmpty ? (
          <Center py={64}>
            <Stack align="center" gap="sm" maw={420}>
              <ThemeIcon variant="light" size={48} radius="xl">
                <IconFilePencil size={26} stroke={1.6} />
              </ThemeIcon>
              <Text ta="center" c="slate.5">
                {typeFilter
                  ? 'No entries for this content type yet. Create the first one.'
                  : 'Entries are the actual content, like a single article or FAQ item. Pick a content type and start writing.'}
              </Text>
              <Button component={Link} href={newEntryHref} leftSection={<IconPlus size={16} />}>
                New entry
              </Button>
            </Stack>
          </Center>
        ) : (
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Title</Table.Th>
                <Table.Th>
                  Type
                  <HelpTip label="The content type this entry fills in" />
                </Table.Th>
                <Table.Th>
                  Status
                  <HelpTip label="Drafts are only visible here; published entries are live" />
                </Table.Th>
                <Table.Th>Updated</Table.Th>
                <Table.Th aria-label="Actions" />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {loading && items.length === 0 ? (
                <SkeletonRows />
              ) : (
                items.map((row) => (
                  <Table.Tr
                    key={row.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/admin/content/entries/${row.id}`)}
                  >
                    <Table.Td fw={600}>{row.title}</Table.Td>
                    <Table.Td c="slate.5">{typeNames.get(row.contentTypeId) ?? '…'}</Table.Td>
                    <Table.Td>
                      <Badge color={STATUS_COLORS[row.status]}>{row.status}</Badge>
                    </Table.Td>
                    <Table.Td c="slate.5">{new Date(row.updatedAt).toLocaleString()}</Table.Td>
                    <Table.Td onClick={(event) => event.stopPropagation()}>
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        {row.status !== 'PUBLISHED' ? (
                          <Tooltip label="Publish">
                            <ActionIcon
                              variant="subtle"
                              color="green"
                              aria-label={`Publish ${row.title}`}
                              onClick={() => confirmPublish(row)}
                            >
                              <IconSend size={16} />
                            </ActionIcon>
                          </Tooltip>
                        ) : null}
                        <Tooltip label="Edit">
                          <ActionIcon
                            component={Link}
                            href={`/admin/content/entries/${row.id}`}
                            variant="subtle"
                            aria-label={`Edit ${row.title}`}
                          >
                            <IconPencil size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            aria-label={`Delete ${row.title}`}
                            onClick={() => confirmDelete(row)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))
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
