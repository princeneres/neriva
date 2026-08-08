'use client';

import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Code,
  Group,
  Select,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import type { components } from '@neriva/contracts';
import { IconInfoCircle } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { HelpTip } from '../../../../components/help-tip';
import { ApiError, api, type PublicUser } from '../../../../lib/api';
import { findFieldError, type Role, userInitials } from '../shared';

type UpdateUserDto = components['schemas']['UpdateUserDto'];

export default function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [roleBusy, setRoleBusy] = useState(false);

  const form = useForm({
    initialValues: { email: '', displayName: '' },
    validate: {
      email: (value) => (/^\S+@\S+\.\S+$/.test(value) ? null : 'Enter a valid email address'),
      displayName: (value) => (value.trim() ? null : 'Enter a name'),
    },
  });

  useEffect(() => {
    api
      .get<{ data: PublicUser }>(`/users/${encodeURIComponent(id)}`)
      .then(({ data }) => {
        setUser(data);
        form.setValues({ email: data.email, displayName: data.displayName });
        form.resetDirty({ email: data.email, displayName: data.displayName });
      })
      .catch((err: unknown) => {
        notifications.show({
          color: 'red',
          title: 'Could not load user',
          message: err instanceof ApiError ? err.message : 'Something went wrong',
        });
      });
    api
      .get<{ data: Role[] }>('/roles?limit=100')
      .then(({ data }) => setRoles(data))
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          notifications.show({
            color: 'red',
            title: 'Could not load roles',
            message: err.message,
          });
        }
      });
    // `form` is intentionally not a dependency: @mantine/form returns a new
    // object each render, and only the initial load should populate values.
  }, [id]);

  async function onSubmit(values: typeof form.values) {
    setBusy(true);
    setFormError(null);
    const body: UpdateUserDto = { email: values.email, displayName: values.displayName };
    try {
      await api.patch<{ data: PublicUser }>(`/users/${encodeURIComponent(id)}`, body);
      notifications.show({ color: 'green', message: 'User updated' });
      router.push('/admin/users');
    } catch (err) {
      if (err instanceof ApiError) {
        const errors = err.problem.errors;
        let mapped = false;
        for (const field of ['email', 'displayName'] as const) {
          const message = findFieldError(errors, field);
          if (message) {
            form.setFieldError(field, message);
            mapped = true;
          }
        }
        if (!mapped) {
          setFormError(err.message);
        }
      } else {
        setFormError('Updating the user failed. Please try again.');
      }
      setBusy(false);
    }
  }

  async function changeRole(assign: boolean) {
    if (!roleId) {
      return;
    }
    setRoleBusy(true);
    try {
      if (assign) {
        await api.post(`/users/${encodeURIComponent(id)}/roles`, { roleId });
        notifications.show({ color: 'green', message: 'Role assigned' });
      } else {
        await api.del(`/users/${encodeURIComponent(id)}/roles/${encodeURIComponent(roleId)}`);
        notifications.show({ color: 'green', message: 'Role unassigned' });
      }
    } catch (err) {
      notifications.show({
        color: 'red',
        title: assign ? 'Assign failed' : 'Unassign failed',
        message: err instanceof ApiError ? err.message : 'Something went wrong',
      });
    } finally {
      setRoleBusy(false);
    }
  }

  if (!user) {
    return (
      <Box maw={560}>
        <Skeleton height={34} width={220} mb="lg" />
        <Card padding="xl">
          <Stack gap="md">
            <Skeleton height={54} />
            <Skeleton height={54} />
            <Skeleton height={36} width={180} />
          </Stack>
        </Card>
      </Box>
    );
  }

  return (
    <Box maw={560}>
      <Group gap="sm" mb="lg" wrap="nowrap">
        <Avatar color="neriva" radius="xl" size={44}>
          {userInitials(user.displayName)}
        </Avatar>
        <Box miw={0}>
          <Title order={1} fz="h2" lh={1.2}>
            {user.displayName}
          </Title>
          <Text c="slate.5">Update this account or change what it is allowed to do.</Text>
        </Box>
      </Group>

      <Stack gap="md">
        <Card padding="xl">
          <form onSubmit={form.onSubmit((values) => void onSubmit(values))}>
            <Stack gap="md">
              {formError ? <Alert color="red">{formError}</Alert> : null}
              <TextInput label="Email" required {...form.getInputProps('email')} />
              <TextInput
                label="Display name"
                description="How this person appears across the admin"
                required
                {...form.getInputProps('displayName')}
              />
              <Group mt="xs">
                <Button type="submit" loading={busy}>
                  Save changes
                </Button>
                <Button component={Link} href="/admin/users" variant="subtle" color="gray">
                  Cancel
                </Button>
              </Group>
            </Stack>
          </form>
        </Card>

        <Card padding="xl">
          <Group gap={4} mb={4}>
            <Title order={3} fz="h4">
              Roles
            </Title>
            <HelpTip label="Roles decide what this user can do. Neriva denies everything by default: users can only do what a role explicitly grants." />
          </Group>
          <Alert color="gray" icon={<IconInfoCircle size={16} />} mb="md">
            The API cannot list this user&apos;s current role assignments yet, so they are not shown
            here. Assigning a role twice or unassigning one that was never assigned is harmless.
          </Alert>
          <Stack gap="md">
            <Select
              label="Role"
              placeholder="Pick a role"
              data={roles.map((role) => ({ value: role.id, label: role.name }))}
              searchable
              clearable
              value={roleId}
              onChange={setRoleId}
            />
            <Group>
              <Button
                variant="light"
                disabled={!roleId}
                loading={roleBusy}
                onClick={() => void changeRole(true)}
              >
                Assign role
              </Button>
              <Button
                variant="subtle"
                color="gray"
                disabled={!roleId || roleBusy}
                onClick={() => void changeRole(false)}
              >
                Unassign role
              </Button>
            </Group>
          </Stack>
        </Card>

        <Card padding="lg" bg="slate.0">
          <Text size="xs" fw={700} tt="uppercase" c="slate.4" lts="0.06em" mb="xs">
            Details
          </Text>
          <Stack gap={6}>
            <Group gap="xs">
              <Text size="sm" c="slate.5" w={110}>
                ID
              </Text>
              <Code>{user.id}</Code>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="slate.5" w={110}>
                Reference code
                <HelpTip label="A stable code integrations can use to refer to this user, even across environments." />
              </Text>
              <Code>{user.externalReferenceCode}</Code>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="slate.5" w={110}>
                Created
              </Text>
              <Text size="sm">{new Date(user.createdAt).toLocaleString()}</Text>
            </Group>
          </Stack>
        </Card>
      </Stack>
    </Box>
  );
}
