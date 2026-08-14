'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Code,
  Divider,
  Group,
  Menu,
  Modal,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconCopy,
  IconDots,
  IconFile,
  IconFilePlus,
  IconPlus,
  IconSearch,
  IconSettings,
  IconTrash,
} from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ApiError, api } from '../../../lib/api';
import { buildHierarchy, type HierarchyNode, pathSegment } from './page-hierarchy';
import { type Page, statusColor } from './types';

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'page' : slug;
}

// Where a new page created from the "+" affordances lands: at the exact
// address of a synthetic node, as a child of a real page, or at the root.
type AddTarget = { mode: 'exact' | 'child' | 'root'; parentPath: string };

function targetPath(target: AddTarget, title: string): string {
  if (target.mode === 'exact') {
    return target.parentPath;
  }
  const prefix = target.mode === 'root' || target.parentPath === '/' ? '' : target.parentPath;
  return `${prefix}/${slugify(title)}`;
}

function problemMessage(error: unknown, fallback: string): ReactNode {
  if (!(error instanceof ApiError)) {
    return fallback;
  }
  const messages = error.problem.errors ?? [];
  return messages.length === 0 ? error.message : messages.join(' ');
}

// The site-scoped page tree, expanded inline under the "Page tree" nav item
// on a public page (browse the site's pages by address, create/duplicate/
// configure/delete without leaving the site). Rendered as the NavLink's own
// children so it opens in place instead of as a separate overlay.
export function SitePageTree({ active, siteSlug }: { active: boolean; siteSlug: string }) {
  const router = useRouter();
  const [siteId, setSiteId] = useState<string | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [addTarget, setAddTarget] = useState<AddTarget | null>(null);
  const [addTitle, setAddTitle] = useState('');
  const [addBusy, setAddBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const sites = await api.get<{ data: { id: string; slug: string }[] }>('/sites?limit=100');
      const site = sites.data.find((candidate) => candidate.slug === siteSlug);
      if (site === undefined) {
        setSiteId(null);
        setPages([]);
        return;
      }
      setSiteId(site.id);
      const list = await api.get<{ data: Page[] }>(`/sites/${site.id}/pages?limit=100`);
      setPages(list.data);
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Could not load pages',
        message: problemMessage(error, 'Failed to load the page tree'),
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (active) {
      void load();
    }
  }, [active, siteSlug]);

  const filteredPages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') {
      return pages;
    }
    return pages.filter(
      (page) => page.title.toLowerCase().includes(q) || page.path.toLowerCase().includes(q),
    );
  }, [pages, query]);

  const hierarchy = useMemo(() => buildHierarchy(filteredPages), [filteredPages]);

  async function submitAddPage() {
    if (addTarget === null || addTitle.trim() === '') {
      return;
    }
    setAddBusy(true);
    try {
      await api.post(`/sites/${siteId}/pages`, {
        title: addTitle.trim(),
        path: targetPath(addTarget, addTitle),
      });
      notifications.show({ color: 'green', message: `"${addTitle.trim()}" was created.` });
      setAddTarget(null);
      setAddTitle('');
      await load();
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Could not create the page',
        message: problemMessage(error, 'Failed to create the page'),
        autoClose: 8000,
      });
    } finally {
      setAddBusy(false);
    }
  }

  async function duplicatePage(page: Page) {
    try {
      await api.post(`/sites/${siteId}/pages`, {
        title: `${page.title} (Copy)`,
        path: page.path === '/' ? '/copy' : `${page.path}-copy`,
        tree: page.tree,
      });
      notifications.show({ color: 'green', message: `"${page.title}" was duplicated.` });
      await load();
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Could not duplicate the page',
        message: problemMessage(error, 'Failed to duplicate the page'),
        autoClose: 8000,
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
      onConfirm: () => void deletePage(page),
    });
  }

  async function deletePage(page: Page) {
    try {
      await api.del(`/pages/${page.id}`);
      notifications.show({ color: 'green', message: `"${page.title}" was deleted.` });
      await load();
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Could not delete the page',
        message: problemMessage(error, 'Failed to delete the page'),
      });
    }
  }

  function goToSettings(page: Page) {
    router.push(`/admin/pages/${page.id}`);
  }

  function TreeRow({ node, depth }: { node: HierarchyNode; depth: number }) {
    const page = node.page;
    return (
      <>
        <Group
          gap={6}
          wrap="nowrap"
          py={4}
          pr={4}
          style={{ paddingLeft: depth * 16 + 6, borderRadius: 6 }}
        >
          <IconFile size={14} stroke={1.7} color="var(--mantine-color-dimmed)" />
          {page ? (
            <UnstyledRowLabel page={page} onClick={() => goToSettings(page)} />
          ) : (
            <Group gap={6} wrap="nowrap" miw={0} style={{ flex: 1 }}>
              <Text size="sm" c="dimmed" fs="italic" truncate>
                {pathSegment(node.path)}
              </Text>
            </Group>
          )}
          {page ? (
            <Menu position="bottom-end" width={190}>
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Page actions">
                  <IconDots size={14} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconFilePlus size={14} />}
                  onClick={() => setAddTarget({ mode: 'child', parentPath: node.path })}
                >
                  Add subpage
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconCopy size={14} />}
                  onClick={() => void duplicatePage(page)}
                >
                  Duplicate page
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconSettings size={14} />}
                  onClick={() => goToSettings(page)}
                >
                  Configure
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconTrash size={14} />}
                  color="red"
                  onClick={() => confirmDelete(page)}
                >
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          ) : (
            <Tooltip label="Create a page at this address">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label="Create a page at this address"
                onClick={() => setAddTarget({ mode: 'exact', parentPath: node.path })}
              >
                <IconPlus size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
        {node.children.map((child) => (
          <TreeRow key={child.path} node={child} depth={depth + 1} />
        ))}
      </>
    );
  }

  return (
    <>
      <Stack gap="xs" py="xs">
        <Group gap="xs" wrap="nowrap">
          <TextInput
            size="xs"
            flex={1}
            placeholder="Search pages"
            leftSection={<IconSearch size={14} />}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          <Tooltip label="New page">
            <ActionIcon
              variant="light"
              disabled={siteId === null}
              aria-label="New page"
              onClick={() => setAddTarget({ mode: 'root', parentPath: '/' })}
            >
              <IconPlus size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
        <Divider />
        <ScrollArea.Autosize mah={280} type="auto">
          {loading ? (
            <Stack gap="xs" p={2}>
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} height={24} radius="sm" />
              ))}
            </Stack>
          ) : hierarchy.length === 0 ? (
            <Text size="sm" c="dimmed" p={2}>
              {query.trim() === '' ? 'No pages in this site yet.' : 'No pages match your search.'}
            </Text>
          ) : (
            hierarchy.map((node) => <TreeRow key={node.path} node={node} depth={0} />)
          )}
        </ScrollArea.Autosize>
      </Stack>

      <Modal
        opened={addTarget !== null}
        onClose={() => setAddTarget(null)}
        title={addTarget?.mode === 'child' ? 'Add subpage' : 'New page'}
        size="sm"
      >
        <Stack gap="sm">
          <TextInput
            label="Title"
            placeholder="About us"
            value={addTitle}
            data-autofocus
            onChange={(event) => setAddTitle(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void submitAddPage();
              }
            }}
          />
          {addTarget !== null && addTarget.mode !== 'exact' ? (
            <Text size="xs" c="dimmed">
              Address: <Code>{targetPath(addTarget, addTitle.trim() === '' ? '…' : addTitle)}</Code>
            </Text>
          ) : null}
          <Group justify="flex-end">
            <Button variant="default" size="xs" onClick={() => setAddTarget(null)}>
              Cancel
            </Button>
            <Button
              size="xs"
              loading={addBusy}
              disabled={addTitle.trim() === ''}
              onClick={() => void submitAddPage()}
            >
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

function UnstyledRowLabel({ page, onClick }: { page: Page; onClick: () => void }) {
  return (
    <Group
      gap={6}
      wrap="nowrap"
      miw={0}
      style={{ flex: 1, cursor: 'pointer' }}
      onClick={onClick}
      title="Open the page settings"
    >
      <Text size="sm" fw={500} truncate>
        {page.title}
      </Text>
      <Badge size="xs" color={statusColor(page.status)}>
        {page.status}
      </Badge>
    </Group>
  );
}
