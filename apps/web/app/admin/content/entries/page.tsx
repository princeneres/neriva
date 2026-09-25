'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Grid,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconFilePencil,
  IconLayoutGrid,
  IconPencil,
  IconPlus,
  IconSearch,
  IconSend,
  IconTrash,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { HelpTip } from '../../../../components/help-tip';
import { CursorPagination } from '../../../../components/cursor-pagination';
import { useCursorPage } from '../../../../components/data-table';
import {
  FolderPanel,
  FolderPicker,
  useFolderOrganization,
} from '../../../../components/folder-organizer';
import { SEARCH_DEBOUNCE_MS, buildListPath, isSearching } from '../../../../lib/list-query';
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
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sort, setSort] = useState('updated');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

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

  // The term is part of the request path, so the server runs the full text
  // search over every entry instead of the page already on screen, and the
  // filtered listing gets its own cache entry.
  const searching = isSearching(debouncedSearch);
  const listPath = useMemo(
    () =>
      buildListPath('/content-entries', {
        contentType: typeFilter,
        folder: selectedFolder,
        search: debouncedSearch,
      }),
    [debouncedSearch, selectedFolder, typeFilter],
  );

  const {
    items,
    loading,
    page,
    limit,
    hasPrevious,
    hasNext,
    refresh,
    first,
    next,
    previous,
    last,
    setLimit,
  } = useCursorPage<ContentEntry>(listPath, (error) =>
    notifications.show({
      color: 'red',
      title: 'Could not load entries',
      message: error.message,
    }),
  );
  const folders = useFolderOrganization('content-entries', items);

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
  // An empty result while searching is not an empty library, so the onboarding
  // card stays out of the way.
  const showEmpty = !loading && !searching && items.length === 0;
  const visibleItems = items
    .filter((row) => selectedFolder === null || folders.folderFor(row.id) === selectedFolder)
    .filter((row) => statusFilter === null || row.status === statusFilter)
    .sort((a, b) =>
      sort === 'title' ? a.title.localeCompare(b.title) : b.updatedAt.localeCompare(a.updatedAt),
    );

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
        <TextInput
          placeholder="Search entries"
          aria-label="Search entries"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          w={240}
        />
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
        <Select
          aria-label="Filter entries by status"
          placeholder="All statuses"
          data={['DRAFT', 'PUBLISHED', 'ARCHIVED']}
          value={statusFilter}
          onChange={setStatusFilter}
          clearable
          w={170}
        />
        <Select
          aria-label="Sort entries"
          data={[
            { value: 'updated', label: 'Recently updated' },
            { value: 'title', label: 'Title: A to Z' },
          ]}
          value={sort}
          onChange={(value) => setSort(value ?? 'updated')}
          allowDeselect={false}
          w={190}
        />
      </Group>

      <Grid gutter="lg" align="flex-start">
        <Grid.Col span={{ base: 12, md: 3, lg: 2.5 }}>
          <FolderPanel
            folders={folders.folders}
            assignments={folders.assignments}
            itemCount={items.length}
            selectedFolder={selectedFolder}
            onSelect={setSelectedFolder}
            onCreate={(name) => void folders.createFolder(name)}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 9, lg: 9.5 }}>
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
              <Table.ScrollContainer minWidth={800} type="native">
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
                    ) : visibleItems.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={5}>
                          <Text size="sm" c="slate.5" ta="center" py="xl">
                            No entries match &quot;{debouncedSearch.trim()}&quot;. Search looks at
                            every entry, title and field values alike.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      visibleItems.map((row) => (
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
                          <Table.Td c="slate.5">
                            {new Date(row.updatedAt).toLocaleString()}
                          </Table.Td>
                          <Table.Td onClick={(event) => event.stopPropagation()}>
                            <Group gap={4} justify="flex-end" wrap="nowrap">
                              <FolderPicker
                                value={folders.folderFor(row.id)}
                                folders={folders.folders}
                                onChange={(folderId) => folders.assignItem(row.id, folderId)}
                              />
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
              </Table.ScrollContainer>
            )}
          </Card>
        </Grid.Col>
      </Grid>

      <CursorPagination
        page={page}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        loading={loading}
        limit={limit}
        onFirst={() => void first()}
        onPrevious={() => void previous()}
        onNext={() => void next()}
        onLast={() => void last()}
        onLimitChange={(nextLimit) => void setLimit(nextLimit)}
      />
    </>
  );
}
