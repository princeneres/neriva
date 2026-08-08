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
import { IconPencil, IconPlus, IconSettings, IconTrash } from '@tabler/icons-react';
import Link from 'next/link';
import { useCursorList } from '../../../components/data-table';
import { HelpTip } from '../../../components/help-tip';
import { ApiError, api } from '../../../lib/api';
import { CommonSettingsCard, type SystemSetting, previewValue } from './shared';

const SKELETON_ROWS = 3;

export default function SettingsListPage() {
  const { items, loading, hasMore, refresh, loadMore } = useCursorList<SystemSetting>(
    '/system/settings',
    (error) => notifications.show({ color: 'red', message: error.message }),
  );

  async function deleteSetting(setting: SystemSetting) {
    try {
      await api.del(`/system/settings/${encodeURIComponent(setting.key)}`);
      notifications.show({ color: 'green', message: `Setting "${setting.key}" deleted` });
      await refresh();
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof ApiError ? error.message : 'Delete failed',
      });
    }
  }

  function confirmDelete(setting: SystemSetting) {
    modals.openConfirmModal({
      title: 'Delete setting',
      children: (
        <Text size="sm">
          Delete the setting <Code>{setting.key}</Code>? Anything that reads it will fall back to
          its default behavior.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => void deleteSetting(setting),
    });
  }

  const showEmpty = !loading && items.length === 0;
  const showSkeleton = loading && items.length === 0;

  return (
    <>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={1} fz="h2">
            Settings
          </Title>
          <Text c="slate.5">
            Small named values that configure how Neriva behaves, like the mail server or the public
            site name.
          </Text>
        </div>
        <Button component={Link} href="/admin/settings/new" leftSection={<IconPlus size={16} />}>
          New setting
        </Button>
      </Group>

      <Card padding={0}>
        {showEmpty ? (
          <Stack align="center" py="xl" gap="sm">
            <ThemeIcon size={44} radius="xl" variant="light">
              <IconSettings size={22} stroke={1.7} />
            </ThemeIcon>
            <Text c="slate.5" ta="center" maw={420}>
              No settings yet. A setting is a named value the system reads at runtime, so you can
              change behavior without redeploying.
            </Text>
            <Button
              component={Link}
              href="/admin/settings/new"
              leftSection={<IconPlus size={16} />}
            >
              New setting
            </Button>
          </Stack>
        ) : (
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>
                  Key
                  <HelpTip label="The unique name used to look this setting up, in the admin and through the API." />
                </Table.Th>
                <Table.Th>
                  Value
                  <HelpTip label="Stored as JSON: text, a number, true/false, or a whole object." />
                </Table.Th>
                <Table.Th>Updated</Table.Th>
                <Table.Th aria-label="Actions" />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {showSkeleton
                ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                    <Table.Tr key={index}>
                      <Table.Td>
                        <Skeleton height={12} width="60%" />
                      </Table.Td>
                      <Table.Td>
                        <Skeleton height={12} width="80%" />
                      </Table.Td>
                      <Table.Td>
                        <Skeleton height={12} width="50%" />
                      </Table.Td>
                      <Table.Td />
                    </Table.Tr>
                  ))
                : items.map((setting) => (
                    <Table.Tr key={setting.id}>
                      <Table.Td>
                        <Code>{setting.key}</Code>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" ff="monospace" c="slate.6">
                          {previewValue(setting.value)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="slate.5">
                          {new Date(setting.updatedAt).toLocaleString()}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} justify="flex-end" wrap="nowrap">
                          <Tooltip label="Edit value">
                            <ActionIcon
                              component={Link}
                              href={`/admin/settings/${encodeURIComponent(setting.key)}`}
                              variant="subtle"
                              aria-label={`Edit ${setting.key}`}
                            >
                              <IconPencil size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              aria-label={`Delete ${setting.key}`}
                              onClick={() => confirmDelete(setting)}
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

      <CommonSettingsCard />
    </>
  );
}
