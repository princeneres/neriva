'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Grid,
  Skeleton,
  Stack,
  Select,
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
  IconFileText,
  IconList,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { HelpTip } from '../../../components/help-tip';
import { CursorPagination } from '../../../components/cursor-pagination';
import { useCursorPage } from '../../../components/data-table';
import {
  FolderPanel,
  FolderPicker,
  useFolderOrganization,
} from '../../../components/folder-organizer';
import { ApiError, api } from '../../../lib/api';
import { SEARCH_DEBOUNCE_MS, buildListPath, isSearching } from '../../../lib/list-query';
import { CONTENT_TYPE_HELP, type ContentType } from './types';

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

export default function ContentTypesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [sort, setSort] = useState('name');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  // The term is part of the request path, so the server filters every content
  // type and the filtered listing gets its own cache entry.
  const searching = isSearching(debouncedSearch);
  const listPath = buildListPath('/content-types', {
    folder: selectedFolder,
    search: debouncedSearch,
  });
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
  } = useCursorPage<ContentType>(listPath, (error) =>
    notifications.show({
      color: 'red',
      title: 'Could not load content types',
      message: error.message,
    }),
  );
  const folders = useFolderOrganization('content-types', items);

  function confirmDelete(contentType: ContentType) {
    modals.openConfirmModal({
      title: 'Delete content type',
      children: (
        <Text size="sm">
          Delete the content type <strong>{contentType.name}</strong>? Types that still have entries
          cannot be deleted.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        void (async () => {
          try {
            await api.del(`/content-types/${contentType.id}`);
            notifications.show({ color: 'green', message: 'Content type deleted' });
            await refresh();
          } catch (error) {
            notifications.show({
              color: 'red',
              title: 'Could not delete content type',
              message:
                error instanceof ApiError ? error.message : 'Deleting the content type failed',
            });
          }
        })();
      },
    });
  }

  const visibleItems = items
    .filter((row) => selectedFolder === null || folders.folderFor(row.id) === selectedFolder)
    .sort((a, b) =>
      sort === 'created' ? b.createdAt.localeCompare(a.createdAt) : a.name.localeCompare(b.name),
    );
  // An empty result while searching is not an empty library, so the onboarding
  // card stays out of the way.
  const showEmpty = !loading && !searching && items.length === 0;

  return (
    <>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={1} fz="h2">
            Content types
            <HelpTip label={CONTENT_TYPE_HELP} />
          </Title>
          <Text c="slate.5">
            Templates for structured content: define the fields once, then write entries that fill
            them in.
          </Text>
        </div>
        <Group gap="sm">
          <Button
            component={Link}
            href="/admin/content/entries"
            variant="default"
            leftSection={<IconList size={16} />}
          >
            Entries
          </Button>
          <Button component={Link} href="/admin/content/new" leftSection={<IconPlus size={16} />}>
            New content type
          </Button>
        </Group>
      </Group>

      <Group mb="md" gap="sm">
        <TextInput
          placeholder="Search content types"
          aria-label="Search content types"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          w={260}
        />
        <Select
          aria-label="Sort content types"
          data={[
            { value: 'name', label: 'Name: A to Z' },
            { value: 'created', label: 'Recently created' },
          ]}
          value={sort}
          onChange={(value) => setSort(value ?? 'name')}
          allowDeselect={false}
          w={180}
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
                    <IconFileText size={26} stroke={1.6} />
                  </ThemeIcon>
                  <Text ta="center" c="slate.5">
                    A content type is a template for your content, like Article or FAQ. Define its
                    fields once, then create as many entries as you need.
                  </Text>
                  <Button
                    component={Link}
                    href="/admin/content/new"
                    leftSection={<IconPlus size={16} />}
                  >
                    New content type
                  </Button>
                </Stack>
              </Center>
            ) : (
              <Table.ScrollContainer minWidth={800} type="native">
                <Table highlightOnHover verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Description</Table.Th>
                      <Table.Th>
                        Fields
                        <HelpTip label="How many fields editors fill in for each entry of this type" />
                      </Table.Th>
                      <Table.Th>Created</Table.Th>
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
                            No content types match &quot;{debouncedSearch.trim()}&quot;.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      visibleItems.map((row) => (
                        <Table.Tr
                          key={row.id}
                          style={{ cursor: 'pointer' }}
                          onClick={() => router.push(`/admin/content/${row.id}`)}
                        >
                          <Table.Td fw={600}>{row.name}</Table.Td>
                          <Table.Td c="slate.5">{row.description ?? ''}</Table.Td>
                          <Table.Td>
                            <Badge color="slate">
                              {row.fields.length} {row.fields.length === 1 ? 'field' : 'fields'}
                            </Badge>
                          </Table.Td>
                          <Table.Td c="slate.5">
                            {new Date(row.createdAt).toLocaleString()}
                          </Table.Td>
                          <Table.Td onClick={(event) => event.stopPropagation()}>
                            <Group gap={4} justify="flex-end" wrap="nowrap">
                              <FolderPicker
                                value={folders.folderFor(row.id)}
                                folders={folders.folders}
                                onChange={(folderId) => folders.assignItem(row.id, folderId)}
                              />
                              <Tooltip label="Edit">
                                <ActionIcon
                                  component={Link}
                                  href={`/admin/content/${row.id}`}
                                  variant="subtle"
                                  aria-label={`Edit ${row.name}`}
                                >
                                  <IconPencil size={16} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Delete">
                                <ActionIcon
                                  variant="subtle"
                                  color="red"
                                  aria-label={`Delete ${row.name}`}
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
