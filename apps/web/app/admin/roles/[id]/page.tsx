'use client';

import { Box, Card, Group, Skeleton, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { components } from '@neriva/contracts';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { ApiError, api } from '../../../../lib/api';
import { RoleForm, type RoleFormValues } from '../role-form';
import { type Role, roleDescription } from '../shared';

type UpdateRoleDto = components['schemas']['UpdateRoleDto'];

export default function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [initial, setInitial] = useState<RoleFormValues | null>(null);

  useEffect(() => {
    api
      .get<{ data: Role }>(`/roles/${encodeURIComponent(id)}`)
      .then(({ data }) => {
        setInitial({
          name: data.name,
          description: roleDescription(data),
          permissions: data.permissions,
        });
      })
      .catch((err: unknown) => {
        notifications.show({
          color: 'red',
          title: 'Could not load role',
          message: err instanceof ApiError ? err.message : 'Something went wrong',
        });
      });
  }, [id]);

  async function onSubmit(values: RoleFormValues) {
    const body: UpdateRoleDto = {
      name: values.name,
      description: values.description,
      permissions: values.permissions,
    };
    await api.patch<{ data: Role }>(`/roles/${encodeURIComponent(id)}`, body);
    notifications.show({ color: 'green', message: 'Role updated' });
    router.push('/admin/roles');
  }

  return (
    <Box maw={640}>
      <Group justify="space-between" mb="lg">
        <Box>
          <Title order={1} fz="h2">
            Edit role
          </Title>
          <Text c="slate.5">
            Changes apply to every user with this role the next time they act.
          </Text>
        </Box>
      </Group>
      {initial ? (
        <RoleForm initial={initial} submitLabel="Save changes" onSubmit={onSubmit} />
      ) : (
        <Card padding="xl">
          <Stack gap="md">
            <Skeleton height={54} />
            <Skeleton height={70} />
            <Skeleton height={36} width={220} />
          </Stack>
        </Card>
      )}
    </Box>
  );
}
