'use client';

import {
  ActionIcon,
  Avatar,
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
import { IconPencil, IconPlus, IconTrash, IconUsers } from '@tabler/icons-react';
import Link from 'next/link';
import { useCursorList } from '../../../components/data-table';
import { HelpTip } from '../../../components/help-tip';
import { ApiError, api, type PublicUser } from '../../../lib/api';
import { userInitials } from './shared';

const COLUMN_COUNT = 4;

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2].map((index) => (
        <Table.Tr key={index}>
          <Table.Td>
            <Group gap="sm" wrap="nowrap">
              <Skeleton circle height={34} />
              <Box flex={1}>
                <Skeleton height={12} width="40%" mb={6} />
                <Skeleton height={10} width="60%" />
              </Box>
            </Group>
          </Table.Td>
          <Table.Td>
            <Skeleton height={12} width={60} />
          </Table.Td>
          <Table.Td>
            <Skeleton height={12} width={120} />
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
          <Stack align="center" gap="sm" maw={380}>
            <ThemeIcon size={48} radius="xl" variant="light">
              <IconUsers size={24} stroke={1.6} />
            </ThemeIcon>
            <Text ta="center" c="slate.5" size="sm">
              Users are the people who can sign in to this admin. Invite a teammate by creating
              their account with a temporary password.
            </Text>
            <Button
              component={Link}
              href="/admin/users/new"
              leftSection={<IconPlus size={16} />}
              mt={4}
            >
              New user
            </Button>
          </Stack>
        </Center>
      </Table.Td>
    </Table.Tr>
  );
}

export default function UsersPage() {
  const { items, loading, hasMore, refresh, loadMore } = useCursorList<PublicUser>(
    '/users',
    (error) =>
      notifications.show({ color: 'red', title: 'Could not load users', message: error.message }),
  );

  function confirmDelete(user: PublicUser) {
    modals.openConfirmModal({
      title: 'Delete user',
      children: (
        <Text size="sm">
          This permanently removes <strong>{user.email}</strong>. They will no longer be able to
          sign in.
        </Text>
      ),
      labels: { confirm: 'Delete user', cancel: 'Keep user' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        void (async () => {
          try {
            await api.del(`/users/${user.id}`);
            notifications.show({ color: 'green', message: 'User deleted' });
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
            Users
          </Title>
          <Text c="slate.5">People who can sign in to this admin and work on your content.</Text>
        </Box>
        <Button component={Link} href="/admin/users/new" leftSection={<IconPlus size={16} />}>
          New user
        </Button>
      </Group>

      <Card padding={0}>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>User</Table.Th>
              <Table.Th>
                Must change password
                <HelpTip label="New users get a temporary password. This badge shows who still has to pick their own password on first sign-in." />
              </Table.Th>
              <Table.Th>Created</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((user) => (
              <Table.Tr key={user.id}>
                <Table.Td>
                  <Group gap="sm" wrap="nowrap">
                    <Avatar color="neriva" radius="xl" size={34}>
                      {userInitials(user.displayName)}
                    </Avatar>
                    <Box miw={0}>
                      <Text size="sm" fw={600} truncate>
                        {user.displayName}
                      </Text>
                      <Text size="xs" c="slate.4" truncate>
                        {user.email}
                      </Text>
                    </Box>
                  </Group>
                </Table.Td>
                <Table.Td>
                  {user.mustChangePassword ? (
                    <Badge color="yellow">Pending</Badge>
                  ) : (
                    <Badge color="gray">No</Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="slate.5">
                    {new Date(user.createdAt).toLocaleString()}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap={4} justify="flex-end" wrap="nowrap">
                    <Tooltip label="Edit user">
                      <ActionIcon
                        component={Link}
                        href={`/admin/users/${encodeURIComponent(user.id)}`}
                        variant="subtle"
                        aria-label={`Edit ${user.email}`}
                      >
                        <IconPencil size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Delete user">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label={`Delete ${user.email}`}
                        onClick={() => confirmDelete(user)}
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
