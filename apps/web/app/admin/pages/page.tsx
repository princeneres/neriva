'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Code,
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
import { IconFiles, IconPencil, IconPlus, IconRocket, IconTrash } from '@tabler/icons-react';
import Link from 'next/link';
import { type ReactNode, useEffect, useState } from 'react';
import { useCursorList } from '../../../components/data-table';
import { HelpTip } from '../../../components/help-tip';
import { ApiError, api } from '../../../lib/api';
import { type Page, type Site, statusColor } from './types';

// Notification body for API failures: the problem detail plus any per-node
// pointers (e.g. blocks[0].slots.main[2]) the validation returned.
function problemContent(error: unknown, fallback: string): ReactNode {
  if (!(error instanceof ApiError)) {
    return fallback;
  }
  const messages = error.problem.errors ?? [];
  if (messages.length === 0) {
    return error.message;
  }
  return (
    <Stack gap={2}>
      <Text size="sm">{error.message}</Text>
      {messages.map((message) => (
        <Text size="sm" key={message}>
          {message}
        </Text>
      ))}
    </Stack>
  );
}

function SitePages({ siteId }: { siteId: string }) {
  const { items, loading, hasMore, refresh, loadMore } = useCursorList<Page>(
    `/sites/${siteId}/pages`,
    (error) =>
      notifications.show({ color: 'red', title: 'Could not load pages', message: error.message }),
  );

  function confirmPublish(page: Page) {
    modals.openConfirmModal({
      title: 'Publish page',
      children: (
        <Text size="sm">
          Publish &quot;{page.title}&quot;? It becomes visible to visitors at{' '}
          <Code>{page.path}</Code>.
        </Text>
      ),
      labels: { confirm: 'Publish', cancel: 'Not yet' },
      onConfirm: () => void publish(page),
    });
  }

  async function publish(page: Page) {
    try {
      await api.post(`/pages/${page.id}/publish`);
      notifications.show({ color: 'green', message: `"${page.title}" is now published.` });
      await refresh();
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Publish failed',
        message: problemContent(error, 'Failed to publish the page'),
        autoClose: 10000,
      });
    }
  }

  function confirmDelete(page: Page) {
    modals.openConfirmModal({
      title: 'Delete page',
      children: (
        <Text size="sm">
          Delete &quot;{page.title}&quot; and everything on it? This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Keep it' },
      confirmProps: { color: 'red' },
      onConfirm: () => void remove(page),
    });
  }

  async function remove(page: Page) {
    try {
      await api.del(`/pages/${page.id}`);
      notifications.show({ color: 'green', message: `"${page.title}" was deleted.` });
      await refresh();
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Delete failed',
        message: problemContent(error, 'Failed to delete the page'),
      });
    }
  }

  const showSkeleton = loading && items.length === 0;

  return (
    <>
      <Card padding={0}>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Title</Table.Th>
              <Table.Th>
                Path
                <HelpTip label="The address of the page inside its site, for example /about." />
              </Table.Th>
              <Table.Th>
                Status
                <HelpTip label="Only published pages are visible to visitors. Drafts are safe to work on." />
              </Table.Th>
              <Table.Th>Updated</Table.Th>
              <Table.Th aria-label="Actions" />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {showSkeleton
              ? [0, 1, 2].map((row) => (
                  <Table.Tr key={row}>
                    {[0, 1, 2, 3, 4].map((cell) => (
                      <Table.Td key={cell}>
                        <Skeleton height={16} radius="sm" />
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))
              : null}
            {items.map((page) => (
              <Table.Tr key={page.id}>
                <Table.Td fw={500}>{page.title}</Table.Td>
                <Table.Td>
                  <Code>{page.path}</Code>
                </Table.Td>
                <Table.Td>
                  <Badge color={statusColor(page.status)}>{page.status}</Badge>
                </Table.Td>
                <Table.Td c="slate.5">{new Date(page.updatedAt).toLocaleString()}</Table.Td>
                <Table.Td>
                  <Group gap={4} justify="flex-end" wrap="nowrap">
                    <Tooltip label="Edit">
                      <ActionIcon
                        variant="subtle"
                        color="slate"
                        component={Link}
                        href={`/admin/pages/${page.id}`}
                        aria-label={`Edit ${page.title}`}
                      >
                        <IconPencil size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Publish">
                      <ActionIcon
                        variant="subtle"
                        color="green"
                        onClick={() => confirmPublish(page)}
                        aria-label={`Publish ${page.title}`}
                      >
                        <IconRocket size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Delete">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => confirmDelete(page)}
                        aria-label={`Delete ${page.title}`}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!loading && items.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Stack align="center" gap="sm" py="xl">
                    <ThemeIcon size={44} radius="xl" variant="light">
                      <IconFiles size={22} stroke={1.6} />
                    </ThemeIcon>
                    <Text fw={600}>No pages in this site yet</Text>
                    <Text size="sm" c="slate.5" ta="center" maw={380}>
                      A page is what visitors see: a stack of blocks with your content, published at
                      an address like /home.
                    </Text>
                    <Button
                      component={Link}
                      href={`/admin/pages/new?site=${siteId}`}
                      leftSection={<IconPlus size={16} />}
                    >
                      New page
                    </Button>
                  </Stack>
                </Table.Td>
              </Table.Tr>
            ) : null}
          </Table.Tbody>
        </Table>
      </Card>
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

export default function PagesListPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [siteId, setSiteId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: Site[] }>('/sites?limit=100')
      .then(({ data }) => setSites(data))
      .catch((error: unknown) => {
        notifications.show({
          color: 'red',
          title: 'Could not load sites',
          message: error instanceof ApiError ? error.message : 'Request failed',
        });
      })
      .finally(() => setSitesLoading(false));
  }, []);

  return (
    <Box maw={960}>
      <Group justify="space-between" mb="lg" align="flex-start">
        <Box>
          <Title order={1} fz="h2">
            Pages
          </Title>
          <Text c="slate.5">
            Pages are built by stacking blocks. Pick a site to see and edit its pages.
          </Text>
        </Box>
        {siteId !== null ? (
          <Button
            component={Link}
            href={`/admin/pages/new?site=${siteId}`}
            leftSection={<IconPlus size={16} />}
          >
            New page
          </Button>
        ) : (
          <Button leftSection={<IconPlus size={16} />} disabled title="Choose a site first">
            New page
          </Button>
        )}
      </Group>

      <Select
        label={
          <>
            Site
            <HelpTip label="A site groups pages under one address. Every page belongs to exactly one site." />
          </>
        }
        placeholder={sitesLoading ? 'Loading sites...' : 'Choose a site'}
        data={sites.map((site) => ({ value: site.id, label: site.name }))}
        value={siteId}
        onChange={setSiteId}
        disabled={sitesLoading}
        searchable
        maw={380}
        mb="lg"
      />

      {siteId === null ? (
        <Card padding="xl">
          <Stack align="center" gap="sm" py="lg">
            <ThemeIcon size={44} radius="xl" variant="light">
              <IconFiles size={22} stroke={1.6} />
            </ThemeIcon>
            <Text fw={600}>Pick a site to get started</Text>
            <Text size="sm" c="slate.5" ta="center" maw={400}>
              Every page lives inside a site. Choose one above to see its pages, or create a site
              first if the list is empty.
            </Text>
          </Stack>
        </Card>
      ) : (
        <SitePages key={siteId} siteId={siteId} />
      )}
    </Box>
  );
}
