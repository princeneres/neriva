'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Code,
  Group,
  SegmentedControl,
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
  IconExternalLink,
  IconFile,
  IconFiles,
  IconListTree,
  IconPencil,
  IconPlus,
  IconRocket,
  IconTable,
  IconTrash,
  IconWorld,
} from '@tabler/icons-react';
import Link from 'next/link';
import { type ReactNode, useMemo, useState } from 'react';
import { useCursorList } from '../../../components/data-table';
import { HelpTip } from '../../../components/help-tip';
import { ApiError, api } from '../../../lib/api';
import { publicPageUrl, type SiteSummary, useSite } from '../../../lib/site-context';
import { buildHierarchy, type HierarchyNode, pathSegment } from './page-hierarchy';
import classes from './pages.module.css';
import { type Page, statusColor } from './types';

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

// The "how do I see my page" affordance: published pages open the public URL
// in a new tab; drafts explain what is missing on a disabled icon.
function ViewPageAction({ page, siteSlug }: { page: Page; siteSlug: string }) {
  if (page.status === 'PUBLISHED') {
    return (
      <Tooltip label="View the live page">
        <ActionIcon
          variant="subtle"
          color="slate"
          component="a"
          href={publicPageUrl(siteSlug, page.path)}
          target="_blank"
          rel="noopener"
          aria-label={`View ${page.title}`}
        >
          <IconExternalLink size={16} />
        </ActionIcon>
      </Tooltip>
    );
  }
  return (
    <Tooltip label="Publish to get a public link">
      <Box component="span" style={{ display: 'inline-flex' }}>
        <ActionIcon variant="subtle" color="slate" disabled aria-label={`View ${page.title}`}>
          <IconExternalLink size={16} />
        </ActionIcon>
      </Box>
    </Tooltip>
  );
}

function PageRowActions({
  page,
  siteSlug,
  onPublish,
  onDelete,
}: {
  page: Page;
  siteSlug: string;
  onPublish: (page: Page) => void;
  onDelete: (page: Page) => void;
}) {
  return (
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
      <ViewPageAction page={page} siteSlug={siteSlug} />
      <Tooltip label="Publish">
        <ActionIcon
          variant="subtle"
          color="green"
          onClick={() => onPublish(page)}
          aria-label={`Publish ${page.title}`}
        >
          <IconRocket size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Delete">
        <ActionIcon
          variant="subtle"
          color="red"
          onClick={() => onDelete(page)}
          aria-label={`Delete ${page.title}`}
        >
          <IconTrash size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

function EmptyState({ siteId }: { siteId: string }) {
  return (
    <Stack align="center" gap="sm" py="xl">
      <ThemeIcon size={44} radius="xl" variant="light">
        <IconFiles size={22} stroke={1.6} />
      </ThemeIcon>
      <Text fw={600}>No pages in this site yet</Text>
      <Text size="sm" c="slate.5" ta="center" maw={380}>
        A page is what visitors see: a stack of blocks with your content, published at an address
        like /home.
      </Text>
      <Button
        component={Link}
        href={`/admin/pages/new?site=${siteId}`}
        leftSection={<IconPlus size={16} />}
      >
        New page
      </Button>
    </Stack>
  );
}

function TreeRow({
  node,
  depth,
  siteSlug,
  onPublish,
  onDelete,
}: {
  node: HierarchyNode;
  depth: number;
  siteSlug: string;
  onPublish: (page: Page) => void;
  onDelete: (page: Page) => void;
}) {
  const page = node.page;
  return (
    <>
      <div className={classes.treeRow} style={{ paddingLeft: depth * 24 + 10 }}>
        <IconFile
          size={15}
          stroke={1.7}
          color={`var(--mantine-color-slate-${page ? 5 : 3})`}
          style={{ flexShrink: 0 }}
        />
        <Group gap="xs" wrap="nowrap" miw={0} style={{ flex: 1 }}>
          {page ? (
            <Text size="sm" fw={500} truncate>
              {page.title}
            </Text>
          ) : (
            <Text size="sm" c="slate.4" fs="italic" truncate>
              {pathSegment(node.path)} (no page at this address)
            </Text>
          )}
          <Code>{node.path}</Code>
          {page ? <Badge color={statusColor(page.status)}>{page.status}</Badge> : null}
        </Group>
        {page ? (
          <div className={classes.treeActions}>
            <PageRowActions
              page={page}
              siteSlug={siteSlug}
              onPublish={onPublish}
              onDelete={onDelete}
            />
          </div>
        ) : null}
      </div>
      {node.children.map((child) => (
        <TreeRow
          key={child.path}
          node={child}
          depth={depth + 1}
          siteSlug={siteSlug}
          onPublish={onPublish}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

function SitePages({ site, view }: { site: SiteSummary; view: 'tree' | 'table' }) {
  const { items, loading, hasMore, refresh, loadMore } = useCursorList<Page>(
    `/sites/${site.id}/pages?limit=100`,
    (error) =>
      notifications.show({ color: 'red', title: 'Could not load pages', message: error.message }),
  );

  const hierarchy = useMemo(() => buildHierarchy(items), [items]);

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

  if (view === 'tree') {
    return (
      <>
        <Card padding="sm">
          {showSkeleton ? (
            <Stack gap="xs" p="xs">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} height={28} radius="sm" />
              ))}
            </Stack>
          ) : items.length === 0 ? (
            <EmptyState siteId={site.id} />
          ) : (
            hierarchy.map((node) => (
              <TreeRow
                key={node.path}
                node={node}
                depth={0}
                siteSlug={site.slug}
                onPublish={confirmPublish}
                onDelete={confirmDelete}
              />
            ))
          )}
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
                  <PageRowActions
                    page={page}
                    siteSlug={site.slug}
                    onPublish={confirmPublish}
                    onDelete={confirmDelete}
                  />
                </Table.Td>
              </Table.Tr>
            ))}
            {!loading && items.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <EmptyState siteId={site.id} />
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
  const { current, loading } = useSite();
  const [view, setView] = useState<'tree' | 'table'>('tree');

  return (
    <Box maw={960}>
      <Group justify="space-between" mb="lg" align="flex-start">
        <Box>
          <Title order={1} fz="h2">
            Pages
          </Title>
          <Text c="slate.5">
            Pages are built by stacking blocks. Use the site switcher in the sidebar to change which
            site you are working on.
          </Text>
        </Box>
        {current ? (
          <Button
            component={Link}
            href={`/admin/pages/new?site=${current.id}`}
            leftSection={<IconPlus size={16} />}
          >
            New page
          </Button>
        ) : (
          <Button leftSection={<IconPlus size={16} />} disabled title="Create a site first">
            New page
          </Button>
        )}
      </Group>

      {loading ? (
        <Stack gap="md">
          <Skeleton height={32} width={220} radius="md" />
          <Skeleton height={180} radius="lg" />
        </Stack>
      ) : current === null ? (
        <Card padding="xl">
          <Stack align="center" gap="sm" py="lg">
            <ThemeIcon size={44} radius="xl" variant="light">
              <IconWorld size={22} stroke={1.6} />
            </ThemeIcon>
            <Text fw={600}>Create a site first</Text>
            <Text size="sm" c="slate.5" ta="center" maw={400}>
              Every page lives inside a site: it groups pages under one address. Create your first
              site, then come back here to build pages.
            </Text>
            <Button component={Link} href="/admin/sites" leftSection={<IconWorld size={16} />}>
              Go to Sites
            </Button>
          </Stack>
        </Card>
      ) : (
        <>
          <Group mb="md">
            <SegmentedControl
              value={view}
              onChange={(next) => setView(next === 'table' ? 'table' : 'tree')}
              data={[
                {
                  value: 'tree',
                  label: (
                    <Group gap={6} wrap="nowrap">
                      <IconListTree size={15} />
                      <span>Tree</span>
                    </Group>
                  ),
                },
                {
                  value: 'table',
                  label: (
                    <Group gap={6} wrap="nowrap">
                      <IconTable size={15} />
                      <span>Table</span>
                    </Group>
                  ),
                },
              ]}
            />
            <HelpTip label="Tree groups pages by their address, so /about/team shows up under /about. Table is a flat list with dates." />
          </Group>
          <SitePages key={current.id} site={current} view={view} />
        </>
      )}
    </Box>
  );
}
