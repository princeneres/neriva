'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Center,
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
import { IconPencil, IconPlus, IconShieldLock, IconTrash } from '@tabler/icons-react';
import Link from 'next/link';
import { useCursorList } from '../../../components/data-table';
import { HelpTip } from '../../../components/help-tip';
import { ApiError, api } from '../../../lib/api';
import { type Role, roleDescription } from './shared';

const COLUMN_COUNT = 4;

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2].map((index) => (
        <Table.Tr key={index}>
          <Table.Td>
            <Skeleton height={12} width={140} />
          </Table.Td>
          <Table.Td>
            <Skeleton height={12} width="70%" />
          </Table.Td>
          <Table.Td>
            <Skeleton height={12} width={40} />
          </Table.Td>
          <Table.Td />
        </Table.Tr>
      ))}
    </>
  );
}

function EmptyState() {
  return (
    <Table.Tr>
      <Table.Td colSpan={COLUMN_COUNT}>
        <Center py={56}>
          <Stack align="center" gap="sm" maw={400}>
            <ThemeIcon size={48} radius="xl" variant="light">
              <IconShieldLock size={24} stroke={1.6} />
            </ThemeIcon>
            <Text ta="center" c="slate.5" size="sm">
              A role is a named set of permissions you assign to users, like Editor or Publisher.
              Users can only do what a role explicitly grants.
            </Text>
            <Button
              component={Link}
              href="/admin/roles/new"
              leftSection={<IconPlus size={16} />}
              mt={4}
            >
              New role
            </Button>
          </Stack>
        </Center>
      </Table.Td>
    </Table.Tr>
  );
}

export default function RolesPage() {
  const { items, loading, hasMore, refresh, loadMore } = useCursorList<Role>('/roles', (error) =>
    notifications.show({ color: 'red', title: 'Could not load roles', message: error.message }),
  );

  function confirmDelete(role: Role) {
    modals.openConfirmModal({
      title: 'Delete role',
      children: (
        <Text size="sm">
          This permanently removes <strong>{role.name}</strong>. Users who had it lose the
          permissions it granted.
        </Text>
      ),
      labels: { confirm: 'Delete role', cancel: 'Keep role' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        void (async () => {
          try {
            await api.del(`/roles/${role.id}`);
            notifications.show({ color: 'green', message: 'Role deleted' });
            await refresh();
          } catch (error) {
            notifications.show({
              color: 'red',
              title: 'Delete failed',
              message: error instanceof ApiError ? error.message : 'Something went wrong',
            });
          }
        })();
      },
    });
  }

  return (
    <Box maw={960}>
      <Group justify="space-between" mb="lg">
        <Box>
          <Title order={1} fz="h2">
            Roles
          </Title>
          <Text c="slate.5">
            Named permission sets you assign to users, like Editor or Publisher.
          </Text>
        </Box>
        <Button component={Link} href="/admin/roles/new" leftSection={<IconPlus size={16} />}>
          New role
        </Button>
      </Group>

      <Card padding={0}>
        <Table.ScrollContainer minWidth={700} type="native">
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Description</Table.Th>
                <Table.Th>
                  Permissions
                  <HelpTip label="How many things this role allows. Users can only do what a role explicitly grants; everything else is denied." />
                </Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((role) => (
                <Table.Tr key={role.id}>
                  <Table.Td>
                    <Text size="sm" fw={600}>
                      {role.name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="slate.5">
                      {roleDescription(role)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={role.permissions.length > 0 ? 'neriva' : 'gray'}>
                      {role.permissions.length}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                      <Tooltip label="Edit role">
                        <ActionIcon
                          component={Link}
                          href={`/admin/roles/${encodeURIComponent(role.id)}`}
                          variant="subtle"
                          aria-label={`Edit ${role.name}`}
                        >
                          <IconPencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Delete role">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          aria-label={`Delete ${role.name}`}
                          onClick={() => confirmDelete(role)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {loading && items.length === 0 ? <SkeletonRows /> : null}
              {!loading && items.length === 0 ? <EmptyState /> : null}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>

      {hasMore ? (
        <Center mt="md">
          <Button variant="light" loading={loading} onClick={() => void loadMore()}>
            Load more
          </Button>
        </Center>
      ) : null}
    </Box>
  );
}
