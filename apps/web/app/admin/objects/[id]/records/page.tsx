'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  Skeleton,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconFilter,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTable,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useCursorList } from '../../../../../components/data-table';
import { HelpTip } from '../../../../../components/help-tip';
import { ApiError, api } from '../../../../../lib/api';
import type { ObjectDefinition, ObjectField, ObjectRecord } from '../../types';

function renderValue(field: ObjectField, value: unknown): ReactNode {
  if (value === null || value === undefined) {
    return '';
  }
  if (field.type === 'boolean') {
    return value === true ? <Badge color="green">Yes</Badge> : <Badge color="gray">No</Badge>;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  return JSON.stringify(value);
}

interface AppliedFilter {
  key: string;
  value: string;
}

const SKELETON_ROWS = [1, 2, 3, 4];

export default function ObjectRecordsPage() {
  const { id } = useParams<{ id: string }>();
  const [definition, setDefinition] = useState<ObjectDefinition | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterKey, setFilterKey] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState('');
  const [applied, setApplied] = useState<AppliedFilter | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: ObjectDefinition }>(`/object-definitions/${id}`)
      .then(({ data }) => setDefinition(data))
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load the object');
      });
  }, [id]);

  // Sorted record queries are intentionally kept separate from cursor pages by
  // the API. Selecting a field therefore resets the list to its first page.
  const listPath = useMemo(() => {
    const base = `/object-definitions/${id}/records`;
    const params = new URLSearchParams();
    if (applied) {
      params.set(`filter[${applied.key}]`, applied.value);
    }
    if (sortKey) {
      params.set('sort', sortKey);
    }
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  }, [id, applied, sortKey]);

  const { items, loading, hasMore, refresh, loadMore } = useCursorList<ObjectRecord>(
    listPath,
    (error) =>
      notifications.show({
        color: 'red',
        title: 'Could not load records',
        message: error.message,
      }),
  );

  const filterField = definition?.fields.find((field) => field.key === filterKey) ?? null;

  function onFilterFieldChange(key: string | null) {
    setFilterKey(key);
    const field = definition?.fields.find((candidate) => candidate.key === key) ?? null;
    // Booleans filter with a Switch, so the value is always defined.
    setFilterValue(field?.type === 'boolean' ? 'false' : '');
  }

  function applyFilter() {
    if (!filterField || filterValue === '') {
      return;
    }
    setApplied({ key: filterField.key, value: filterValue });
  }

  function clearFilter() {
    setFilterKey(null);
    setFilterValue('');
    setApplied(null);
  }

  function confirmDelete(record: ObjectRecord) {
    modals.openConfirmModal({
      title: 'Delete record',
      children: <Text size="sm">Delete this record? This cannot be undone.</Text>,
      labels: { confirm: 'Delete record', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        void (async () => {
          try {
            await api.del(`/object-records/${record.id}`);
            notifications.show({
              color: 'green',
              title: 'Record deleted',
              message: 'The record was deleted.',
            });
            await refresh();
          } catch (error) {
            notifications.show({
              color: 'red',
              title: 'Could not delete',
              message: error instanceof ApiError ? error.message : 'Failed to delete the record.',
            });
          }
        })();
      },
    });
  }

  const fields = definition?.fields ?? [];
  const needle = search.trim().toLowerCase();
  const visibleItems = items.filter((record) => {
    if (!needle) return true;
    return Object.values(record.data).some((value) =>
      String(value ?? '')
        .toLowerCase()
        .includes(needle),
    );
  });
  const showEmptyState = definition !== null && !loading && items.length === 0;

  return (
    <>
      <Group justify="space-between" mb="lg">
        <div>
          <Group gap={6}>
            <Title order={1} fz="h2">
              {definition ? definition.pluralName : 'Records'}
            </Title>
            <HelpTip label="Records are the rows of this table. Each one fills in the fields the object defines." />
          </Group>
          <Text c="slate.5">
            {definition
              ? `Browse and manage the ${definition.pluralName.toLowerCase()} stored in this object.`
              : 'Browse and manage the records stored in this object.'}
          </Text>
        </div>
        <Group gap="xs">
          <Button
            component={Link}
            href="/admin/objects"
            variant="subtle"
            color="gray"
            leftSection={<IconArrowLeft size={16} />}
          >
            All objects
          </Button>
          <Button
            component={Link}
            href={`/admin/objects/${id}/records/new`}
            leftSection={<IconPlus size={16} />}
          >
            New record
          </Button>
        </Group>
      </Group>

      {loadError ? (
        <Alert color="red" title="Could not load" mb="md">
          {loadError}
        </Alert>
      ) : null}

      {definition && fields.length > 0 ? (
        <Group gap="sm" mb="md" align="flex-end">
          <TextInput
            w={240}
            label="Search records"
            placeholder="Search field values"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <Select
            w={200}
            label={
              <>
                Filter by
                <HelpTip label="Show only the records where a field has an exact value" />
              </>
            }
            placeholder="Choose a field"
            data={fields.map((field) => ({ value: field.key, label: field.label }))}
            value={filterKey}
            onChange={onFilterFieldChange}
            clearable
          />
          {filterField?.type === 'boolean' ? (
            <Switch
              mb={8}
              label={filterValue === 'true' ? 'Yes' : 'No'}
              checked={filterValue === 'true'}
              onChange={(event) => setFilterValue(event.currentTarget.checked ? 'true' : 'false')}
            />
          ) : filterField?.type === 'picklist' ? (
            <Select
              w={200}
              label="Value"
              placeholder="Pick one"
              data={filterField.options ?? []}
              value={filterValue === '' ? null : filterValue}
              onChange={(value) => setFilterValue(value ?? '')}
            />
          ) : filterField?.type === 'number' ? (
            <NumberInput
              w={160}
              label="Value"
              value={filterValue === '' ? '' : Number(filterValue)}
              onChange={(value) => setFilterValue(typeof value === 'number' ? String(value) : '')}
            />
          ) : filterField?.type === 'date' ? (
            <TextInput
              w={180}
              type="date"
              label="Value"
              value={filterValue}
              onChange={(event) => setFilterValue(event.currentTarget.value)}
            />
          ) : (
            <TextInput
              w={200}
              label="Value"
              placeholder="Value"
              disabled={!filterField}
              value={filterValue}
              onChange={(event) => setFilterValue(event.currentTarget.value)}
            />
          )}
          <Button
            variant="light"
            leftSection={<IconFilter size={16} />}
            disabled={!filterField || filterValue === ''}
            onClick={applyFilter}
          >
            Apply
          </Button>
          {applied ? (
            <Button
              variant="subtle"
              color="gray"
              leftSection={<IconX size={16} />}
              onClick={clearFilter}
            >
              Clear filter
            </Button>
          ) : null}
          <Select
            w={200}
            label="Sort by"
            placeholder="Default order"
            data={fields.map((field) => ({ value: field.key, label: field.label }))}
            value={sortKey}
            onChange={setSortKey}
            clearable
          />
        </Group>
      ) : null}

      {definition || !loadError ? (
        <Card padding={0}>
          {showEmptyState ? (
            <Stack align="center" gap="sm" py={56} px="md">
              <ThemeIcon size={44} radius="md" variant="light">
                <IconTable size={24} stroke={1.7} />
              </ThemeIcon>
              {applied ? (
                <>
                  <Text c="slate.5" ta="center" maw={420}>
                    No records match this filter. Try a different value or clear it.
                  </Text>
                  <Button variant="light" onClick={clearFilter}>
                    Clear filter
                  </Button>
                </>
              ) : (
                <>
                  <Text c="slate.5" ta="center" maw={420}>
                    {definition
                      ? `No ${definition.pluralName.toLowerCase()} yet. Records are the rows of this table: add the first one.`
                      : 'No records yet.'}
                  </Text>
                  <Button
                    component={Link}
                    href={`/admin/objects/${id}/records/new`}
                    leftSection={<IconPlus size={16} />}
                  >
                    New record
                  </Button>
                </>
              )}
            </Stack>
          ) : (
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  {fields.map((field) => (
                    <Table.Th key={field.key}>{field.label}</Table.Th>
                  ))}
                  <Table.Th>Created</Table.Th>
                  <Table.Th aria-label="Actions" />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {loading && items.length === 0
                  ? SKELETON_ROWS.map((row) => (
                      <Table.Tr key={row}>
                        <Table.Td colSpan={fields.length + 2}>
                          <Skeleton height={14} />
                        </Table.Td>
                      </Table.Tr>
                    ))
                  : visibleItems.map((record) => (
                      <Table.Tr key={record.id}>
                        {fields.map((field) => (
                          <Table.Td key={field.key}>
                            {renderValue(field, record.data[field.key])}
                          </Table.Td>
                        ))}
                        <Table.Td>{new Date(record.createdAt).toLocaleString()}</Table.Td>
                        <Table.Td>
                          <Group gap={4} justify="flex-end" wrap="nowrap">
                            <Tooltip label="Edit record">
                              <ActionIcon
                                component={Link}
                                href={`/admin/objects/records/${record.id}`}
                                variant="subtle"
                                aria-label="Edit record"
                              >
                                <IconPencil size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Delete record">
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                aria-label="Delete record"
                                onClick={() => confirmDelete(record)}
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
      ) : null}

      {hasMore ? (
        <Group justify="center" mt="md">
          <Button variant="light" loading={loading} onClick={() => void loadMore()}>
            Load more
          </Button>
        </Group>
      ) : null}
    </>
  );
}
