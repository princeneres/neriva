'use client';

import { Box, Group, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { components } from '@neriva/contracts';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { RoleForm, type RoleFormValues } from '../role-form';
import type { Role } from '../shared';

type CreateRoleDto = components['schemas']['CreateRoleDto'];

export default function NewRolePage() {
  const router = useRouter();

  async function onSubmit(values: RoleFormValues) {
    const body: CreateRoleDto = {
      name: values.name,
      ...(values.description ? { description: values.description } : {}),
      permissions: values.permissions,
    };
    await api.post<{ data: Role }>('/roles', body);
    notifications.show({ color: 'green', message: 'Role created' });
    router.push('/admin/roles');
  }

  return (
    <Box maw={640}>
      <Group justify="space-between" mb="lg">
        <Box>
          <Title order={1} fz="h2">
            New role
          </Title>
          <Text c="slate.5">
            Name the role, then grant each thing its users should be allowed to do.
          </Text>
        </Box>
      </Group>
      <RoleForm submitLabel="Create role" onSubmit={onSubmit} />
    </Box>
  );
}
