'use client';

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Menu,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconCopy,
  IconDots,
  IconLayoutBoard,
  IconPencil,
  IconPlus,
  IconTemplate,
  IconTrash,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useCursorList } from '../../../components/data-table';
import { ApiError, api } from '../../../lib/api';
import classes from './page-templates-gallery.module.css';
import { countBlocks, type PageTemplate, type PageTemplateKind } from './types';

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}

interface Group {
  key: PageTemplateKind;
  label: string;
  description: string;
  items: PageTemplate[];
}

function groupByKind(items: PageTemplate[]): Group[] {
  const groups: Group[] = [
    {
      key: 'MASTER',
      label: 'Masters',
      description: 'The header, footer and chrome every page renders inside.',
      items: items
        .filter((item) => item.kind === 'MASTER')
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    },
    {
      key: 'STANDARD',
      label: 'Templates',
      description: 'Pre-filled starting points copied into a new page.',
      items: items
        .filter((item) => item.kind === 'STANDARD')
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    },
  ];
  return groups.filter((group) => group.items.length > 0);
}

export default function PageTemplatesPage() {
  const { items, loading, hasMore, refresh, loadMore } = useCursorList<PageTemplate>(
    '/page-templates',
    (error) => notifications.show({ color: 'red', message: error.message }),
  );

  async function duplicate(template: PageTemplate) {
    try {
      const { data: fresh } = await api.get<{ data: PageTemplate }>(
        `/page-templates/${template.id}`,
      );
      const { data: created } = await api.post<{ data: PageTemplate }>('/page-templates', {
        name: `${fresh.name} (copy)`,
        kind: fresh.kind,
        tree: fresh.tree,
      });
      notifications.show({ color: 'green', message: `"${created.name}" was created.` });
      void refresh();
    } catch (error) {
      notifications.show({ color: 'red', message: errorMessage(error) });
    }
  }

  function confirmDelete(template: PageTemplate) {
    modals.openConfirmModal({
      title: 'Delete template',
      children: (
        <Text size="sm">
          Delete &quot;{template.name}&quot;?
          {template.kind === 'MASTER'
            ? ' Pages currently using it as their master page keep working until it is removed here.'
            : ''}{' '}
          This cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        void (async () => {
          try {
            await api.del(`/page-templates/${template.id}`);
            notifications.show({
              color: 'green',
              message: `"${template.name}" deleted`,
            });
            void refresh();
          } catch (error) {
            // The API responds 409 with a detail explaining what still uses
            // this template (spec 14 section 2); surface it verbatim.
            notifications.show({ color: 'red', message: errorMessage(error), autoClose: 8000 });
          }
        })();
      },
    });
  }

  const showEmptyState = !loading && items.length === 0;
  const groups = groupByKind(items);

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={1} fz="h2">
            Page Templates
          </Title>
          <Text c="slate.5">
            Master pages define the chrome every page renders inside. Page templates are pre-filled
            starting points copied into a new page.
          </Text>
        </div>
        <NewTemplateMenu />
      </Group>

      {showEmptyState ? (
        <Card>
          <Stack align="center" gap="xs" py={56} px="md">
            <ThemeIcon size={44} radius="md" variant="light">
              <IconLayoutBoard size={24} stroke={1.7} />
            </ThemeIcon>
            <Text fw={600} mt={4}>
              No page templates yet
            </Text>
            <Text size="sm" c="slate.5" ta="center" maw={420}>
              Create a master page to define a shared header and footer, or a page template as a
              starting point for new pages.
            </Text>
            <NewTemplateMenu mt="sm" />
          </Stack>
        </Card>
      ) : loading && items.length === 0 ? (
        <SimpleGrid cols={{ base: 2, md: 3, lg: 4 }}>
          {[0, 1, 2, 3].map((tile) => (
            <Skeleton key={tile} height={168} radius="md" />
          ))}
        </SimpleGrid>
      ) : (
        <Stack gap="xl">
          {groups.map((group) => (
            <section key={group.key} aria-label={group.label}>
              <Group gap="xs" mb="xs" align="baseline">
                <Text size="xs" fw={600} c="slate.5" tt="uppercase" lts={0.5}>
                  {group.label}
                </Text>
                <Text size="xs" c="slate.4">
                  {group.description}
                </Text>
              </Group>
              <SimpleGrid cols={{ base: 2, md: 3, lg: 4 }}>
                {group.items.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onDuplicate={() => void duplicate(template)}
                    onDelete={() => confirmDelete(template)}
                  />
                ))}
              </SimpleGrid>
            </section>
          ))}
        </Stack>
      )}

      {hasMore ? (
        <Stack align="center" gap={4} mt="lg">
          <Button variant="light" loading={loading} onClick={() => void loadMore()}>
            Load more
          </Button>
          <Text size="xs" c="slate.5">
            More templates exist on the server. Search and filters only cover the templates loaded
            so far.
          </Text>
        </Stack>
      ) : null}
    </div>
  );
}

function NewTemplateMenu({ mt }: { mt?: string }) {
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Button leftSection={<IconPlus size={16} />} mt={mt}>
          New template
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          component={Link}
          href="/admin/page-templates/new?kind=MASTER"
          leftSection={<IconLayoutBoard size={15} />}
        >
          Master page
        </Menu.Item>
        <Menu.Item
          component={Link}
          href="/admin/page-templates/new?kind=STANDARD"
          leftSection={<IconTemplate size={15} />}
        >
          Page template
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

function TemplateCard({
  template,
  onDuplicate,
  onDelete,
}: {
  template: PageTemplate;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const Icon = template.kind === 'MASTER' ? IconLayoutBoard : IconTemplate;
  const blockCount = countBlocks(template.tree);
  return (
    <Card withBorder padding="md" className={classes.card}>
      <Card.Section bg="slate.0" py="lg">
        <Center>
          <ThemeIcon size={44} radius="md" variant="light">
            <Icon size={24} stroke={1.7} />
          </ThemeIcon>
        </Center>
      </Card.Section>
      <Text
        component={Link}
        href={`/admin/page-templates/${template.id}`}
        className={classes.nameLink}
        fw={600}
        size="sm"
        mt="sm"
        truncate
      >
        {template.name}
      </Text>
      <Text size="xs" c="slate.5">
        {blockCount === 0 ? 'Empty' : `${blockCount} block${blockCount === 1 ? '' : 's'}`}
      </Text>
      <Group gap={4} mt="xs">
        {template.kind === 'MASTER' ? (
          <Badge size="xs" color="neriva">
            Master
          </Badge>
        ) : null}
        {template.kind === 'MASTER' && template.isDefault ? (
          <Badge size="xs" color="green" variant="light">
            Default
          </Badge>
        ) : null}
      </Group>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <ActionIcon
            variant="subtle"
            color="slate"
            className={classes.menu}
            aria-label={`Actions for ${template.name}`}
          >
            <IconDots size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            component={Link}
            href={`/admin/page-templates/${template.id}`}
            leftSection={<IconPencil size={14} />}
          >
            Edit
          </Menu.Item>
          <Menu.Item leftSection={<IconCopy size={14} />} onClick={onDuplicate}>
            Duplicate
          </Menu.Item>
          <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={onDelete}>
            Delete
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Card>
  );
}
