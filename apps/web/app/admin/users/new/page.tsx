'use client';

import {
  Alert,
  Box,
  Button,
  Card,
  Group,
  PasswordInput,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import type { components } from '@neriva/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { HelpTip } from '../../../../components/help-tip';
import { ApiError, api, type PublicUser } from '../../../../lib/api';
import { findFieldError, type Role } from '../shared';

type CreateUserDto = components['schemas']['CreateUserDto'];

export default function NewUserPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const form = useForm({
    initialValues: { email: '', displayName: '', password: '', roleId: '' },
    validate: {
      email: (value) => (/^\S+@\S+\.\S+$/.test(value) ? null : 'Enter a valid email address'),
      displayName: (value) => (value.trim() ? null : 'Enter a name'),
      password: (value) => (value.length >= 8 ? null : 'Use at least 8 characters'),
    },
  });

  useEffect(() => {
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
  }, []);

  async function onSubmit(values: typeof form.values) {
    setBusy(true);
    setFormError(null);
    const body: CreateUserDto = {
      email: values.email,
      displayName: values.displayName,
      password: values.password,
      ...(values.roleId ? { roleIds: [values.roleId] } : {}),
    };
    try {
      await api.post<{ data: PublicUser }>('/users', body);
      notifications.show({ color: 'green', message: 'User created' });
      router.push('/admin/users');
    } catch (err) {
      if (err instanceof ApiError) {
        const errors = err.problem.errors;
        let mapped = false;
        for (const field of ['email', 'displayName', 'password'] as const) {
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
        setFormError('Creating the user failed. Please try again.');
      }
      setBusy(false);
    }
  }

  return (
    <Box maw={560}>
      <Group justify="space-between" mb="lg">
        <Box>
          <Title order={1} fz="h2">
            New user
          </Title>
          <Text c="slate.5">Create an account so a teammate can sign in to this admin.</Text>
        </Box>
      </Group>

      <Card padding="xl">
        <form onSubmit={form.onSubmit((values) => void onSubmit(values))}>
          <Stack gap="md">
            {formError ? <Alert color="red">{formError}</Alert> : null}
            <TextInput
              label="Email"
              placeholder="teammate@example.com"
              required
              {...form.getInputProps('email')}
            />
            <TextInput
              label="Display name"
              placeholder="Jane Doe"
              description="How this person appears across the admin"
              required
              {...form.getInputProps('displayName')}
            />
            <PasswordInput
              label={
                <>
                  Temporary password
                  <HelpTip label="Share this password with the new user privately. It only works once: they must replace it before doing anything else." />
                </>
              }
              description="The user will be asked to change it on first sign-in"
              autoComplete="new-password"
              required
              {...form.getInputProps('password')}
            />
            <Select
              label={
                <>
                  Role
                  <HelpTip label="Roles decide what this user is allowed to do. Without a role they can sign in but cannot do anything, since Neriva denies everything a role does not grant." />
                </>
              }
              placeholder="No role yet"
              description="Optional, you can also assign roles later"
              data={roles.map((role) => ({ value: role.id, label: role.name }))}
              searchable
              clearable
              {...form.getInputProps('roleId')}
            />
            <Group mt="xs">
              <Button type="submit" loading={busy}>
                Create user
              </Button>
              <Button component={Link} href="/admin/users" variant="subtle" color="gray">
                Cancel
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </Box>
  );
}
