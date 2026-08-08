'use client';

import type { components } from '@neriva/contracts';
import { useRouter } from 'next/navigation';
import { useToast } from '../../../../components/toast';
import { api } from '../../../../lib/api';
import { RoleForm, type RoleFormValues } from '../role-form';

type Role = components['schemas']['RoleDto'];
type CreateRoleDto = components['schemas']['CreateRoleDto'];

export default function NewRolePage() {
  const router = useRouter();
  const toast = useToast();

  async function onSubmit(values: RoleFormValues) {
    const body: CreateRoleDto = {
      name: values.name,
      ...(values.description ? { description: values.description } : {}),
      permissions: values.permissions,
    };
    await api.post<{ data: Role }>('/roles', body);
    toast.success('Role created');
    router.push('/admin/roles');
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1>New role</h1>
      </div>
      <RoleForm submitLabel="Create role" busyLabel="Creating…" onSubmit={onSubmit} />
    </>
  );
}
