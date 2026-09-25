'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Grid,
  Skeleton,
  Select,
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
  IconDatabase,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTable,
  IconTrash,
} from '@tabler/icons-react';
import Link from 'next/link';
import { CursorPagination } from '../../../components/cursor-pagination';
import { useCursorPage } from '../../../components/data-table';
import {
  FolderPanel,
  FolderPicker,
  useFolderOrganization,
} from '../../../components/folder-organizer';
import { HelpTip } from '../../../components/help-tip';
import { ApiError, api } from '../../../lib/api';
import { SEARCH_DEBOUNCE_MS, buildListPath, isSearching } from '../../../lib/list-query';
import { OBJECTS_HELP, publicAccessLabel, type ObjectDefinition } from './types';
import { useState } from 'react';

const SKELETON_ROWS = [1, 2, 3, 4];

export default function ObjectDefinitionsPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [sort, setSort] = useState('name');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  // The term is part of the request path, so the server filters every object
  // and the filtered listing gets its own cache entry.
  const searching = isSearching(debouncedSearch);
  const listPath = buildListPath('/object-definitions', {
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
  } = useCursorPage<ObjectDefinition>(listPath, (error) =>
    notifications.show({ color: 'red', title: 'Could not load objects', message: error.message }),
  );
  const folders = useFolderOrganization('objects', items);

  function confirmDelete(definition: ObjectDefinition) {
    modals.openConfirmModal({
      title: 'Delete object',
      children: (
        <Text size="sm">
          Delete the object <strong>{definition.name}</strong> and its field definitions? This
          cannot be undone. If it still has records, they must be deleted first.
        </Text>
      ),
      labels: { confirm: 'Delete object', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        void (async () => {
          try {
            await api.del(`/object-definitions/${definition.id}`);
            notifications.show({
              color: 'green',
              title: 'Object deleted',
              message: `"${definition.name}" was deleted.`,
            });
            await refresh();
          } catch (error) {
            // A 409 problem detail (definition still has records) surfaces here.
            notifications.show({
              color: 'red',
              title: 'Could not delete',
              message: error instanceof ApiError ? error.message : 'Failed to delete the object.',
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
  // An empty result while searching is not an empty catalogue, so the
  // onboarding card stays out of the way.
  const showEmptyState = !loading && !searching && items.length === 0;

  return (
    <>
      <Group justify="space-between" mb="lg">
        <div>
          <Group gap={6}>
            <Title order={1} fz="h2">
              Objects
            </Title>
            <HelpTip label={OBJECTS_HELP} />
          </Group>
          <Text c="slate.5">Define a table once, then add records like rows in a spreadsheet.</Text>
        </div>
        <Button component={Link} href="/admin/objects/new" leftSection={<IconPlus size={16} />}>
          New object
        </Button>
      </Group>

      <Group mb="md" gap="sm">
        <TextInput
          placeholder="Search objects"
          aria-label="Search objects"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          w={260}
        />
        <Select
          aria-label="Sort objects"
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
            {showEmptyState ? (
              <Stack align="center" gap="sm" py={56} px="md">
                <ThemeIcon size={44} radius="md" variant="light">
                  <IconDatabase size={24} stroke={1.7} />
                </ThemeIcon>
                <Text c="slate.5" ta="center" maw={420}>
                  Objects are your own data tables, like Products or Leads. Define the columns once
                  and start adding records, no code needed.
                </Text>
                <Button
                  component={Link}
                  href="/admin/objects/new"
                  leftSection={<IconPlus size={16} />}
                >
                  New object
                </Button>
              </Stack>
            ) : (
              <Table.ScrollContainer minWidth={780} type="native">
                <Table highlightOnHover verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Plural name</Table.Th>
                      <Table.Th>
                        Fields
                        <HelpTip label="How many columns this table has" />
                      </Table.Th>
                      <Table.Th>
                        Visibility
                        <HelpTip label="What visitors who are not signed in can do with these records" />
                      </Table.Th>
                      <Table.Th>Created</Table.Th>
                      <Table.Th aria-label="Actions" />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {loading && items.length === 0 ? (
                      SKELETON_ROWS.map((row) => (
                        <Table.Tr key={row}>
                          <Table.Td colSpan={6}>
                            <Skeleton height={14} />
                          </Table.Td>
                        </Table.Tr>
                      ))
                    ) : visibleItems.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={6}>
                          <Text size="sm" c="slate.5" ta="center" py="xl">
                            No objects match &quot;{debouncedSearch.trim()}&quot;.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      visibleItems.map((definition) => (
                        <Table.Tr key={definition.id}>
                          <Table.Td fw={600}>{definition.name}</Table.Td>
                          <Table.Td>{definition.pluralName}</Table.Td>
                          <Table.Td>
                            <Badge color="gray">{definition.fields.length}</Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              variant={definition.publicAccess === 'none' ? 'light' : 'filled'}
                              color={
                                definition.publicAccess === 'read-write'
                                  ? 'orange'
                                  : definition.publicAccess === 'read'
                                    ? 'blue'
                                    : 'gray'
                              }
                            >
                              {publicAccessLabel(definition.publicAccess)}
                            </Badge>
                          </Table.Td>
                          <Table.Td>{new Date(definition.createdAt).toLocaleString()}</Table.Td>
                          <Table.Td>
                            <Group gap={4} justify="flex-end" wrap="nowrap">
                              <FolderPicker
                                value={folders.folderFor(definition.id)}
                                folders={folders.folders}
                                onChange={(folderId) => folders.assignItem(definition.id, folderId)}
                              />
                              <Tooltip label="Browse records">
                                <ActionIcon
                                  component={Link}
                                  href={`/admin/objects/${definition.id}/records`}
                                  variant="subtle"
                                  aria-label={`Browse ${definition.pluralName} records`}
                                >
                                  <IconTable size={16} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Edit object">
                                <ActionIcon
                                  component={Link}
                                  href={`/admin/objects/${definition.id}`}
                                  variant="subtle"
                                  aria-label={`Edit ${definition.name}`}
                                >
                                  <IconPencil size={16} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Delete object">
                                <ActionIcon
                                  variant="subtle"
                                  color="red"
                                  aria-label={`Delete ${definition.name}`}
                                  onClick={() => confirmDelete(definition)}
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
