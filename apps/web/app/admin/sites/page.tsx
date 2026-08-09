'use client';

import {
  ActionIcon,
  Button,
  Card,
  Center,
  Code,
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
import { IconPencil, IconPlus, IconTrash, IconWorld } from '@tabler/icons-react';
import Link from 'next/link';
import { useCursorList } from '../../../components/data-table';
import { HelpTip } from '../../../components/help-tip';
import { ApiError, api } from '../../../lib/api';
import type { Site } from './types';

const SKELETON_ROWS = 3;

export default function SitesPage() {
  const { items, loading, hasMore, refresh, loadMore } = useCursorList<Site>('/sites', (error) =>
    notifications.show({ color: 'red', message: error.message }),
  );

  async function deleteSite(site: Site) {
    try {
      await api.del(`/sites/${site.id}`);
      notifications.show({ color: 'green', message: `Site "${site.name}" was deleted.` });
      await refresh();
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof ApiError ? error.message : 'Could not delete the site.',
      });
    }
  }

  function confirmDelete(site: Site) {
    modals.openConfirmModal({
      title: 'Delete site',
      children: (
        <Text size="sm">
          This will permanently delete <strong>{site.name}</strong> and everything published under
          it will stop being available. This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete site', cancel: 'Keep it' },
      confirmProps: { color: 'red' },
      onConfirm: () => void deleteSite(site),
    });
  }

  const showEmptyState = !loading && items.length === 0;
  const showSkeleton = loading && items.length === 0;

  return (
    <>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={1} fz="h2">
            Sites
          </Title>
          <Text c="slate.5">
            A site groups your pages and content under one address. Most projects start with just
            one.
          </Text>
        </div>
        <Button component={Link} href="/admin/sites/new" leftSection={<IconPlus size={16} />}>
          New site
        </Button>
      </Group>

      <Card padding={0}>
        {showEmptyState ? (
          <Stack align="center" gap="sm" py={64} px="md">
            <ThemeIcon size={44} radius="xl" variant="light">
              <IconWorld size={22} stroke={1.7} />
            </ThemeIcon>
            <Text fw={600}>No sites yet</Text>
            <Text size="sm" c="slate.5" ta="center" maw={380}>
              A site is the home of your pages and content. Create one to start building.
            </Text>
            <Button
              component={Link}
              href="/admin/sites/new"
              leftSection={<IconPlus size={16} />}
              mt="xs"
            >
              Create your first site
            </Button>
          </Stack>
        ) : (
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>
                  Slug
                  <HelpTip label="The short name used in the site's web address, like example.com/my-site." />
                </Table.Th>
                <Table.Th>Description</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th aria-label="Actions" />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {showSkeleton
                ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                    <Table.Tr key={index}>
                      {Array.from({ length: 5 }, (_, cell) => (
                        <Table.Td key={cell}>
                          <Skeleton height={12} radius="xl" />
                        </Table.Td>
                      ))}
                    </Table.Tr>
                  ))
                : items.map((site) => (
                    <Table.Tr key={site.id}>
                      <Table.Td fw={500}>{site.name}</Table.Td>
                      <Table.Td>
                        <Code>{site.slug}</Code>
                      </Table.Td>
                      <Table.Td c="slate.5">{site.description ?? ''}</Table.Td>
                      <Table.Td>{new Date(site.createdAt).toLocaleString()}</Table.Td>
                      <Table.Td>
                        <Group gap={4} justify="flex-end" wrap="nowrap">
                          <Tooltip label="Edit">
                            <ActionIcon
                              component={Link}
                              href={`/admin/sites/${site.id}`}
                              variant="subtle"
                              aria-label={`Edit ${site.name}`}
                            >
                              <IconPencil size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              aria-label={`Delete ${site.name}`}
                              onClick={() => confirmDelete(site)}
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
