'use client';

import type { components } from '@neriva/contracts';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { useToast } from '../../../../components/toast';
import { ApiError, api } from '../../../../lib/api';
import { RoleForm, type RoleFormValues } from '../role-form';

type Role = components['schemas']['RoleDto'];
type UpdateRoleDto = components['schemas']['UpdateRoleDto'];

export default function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [initial, setInitial] = useState<RoleFormValues | null>(null);

  useEffect(() => {
    api
      .get<{ data: Role }>(`/roles/${encodeURIComponent(id)}`)
      .then(({ data }) => {
        setInitial({
          name: data.name,
          // The generator types `description` as an object because the spec
          // declares a nullable string via a YAML type union; at runtime it
          // is string | null.
          description: typeof data.description === 'string' ? data.description : '',
          permissions: data.permissions,
        });
      })
      .catch((err: unknown) => {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load role');
      });
  }, [id, toast]);

  async function onSubmit(values: RoleFormValues) {
    const body: UpdateRoleDto = {
      name: values.name,
      description: values.description,
      permissions: values.permissions,
    };
    await api.patch<{ data: Role }>(`/roles/${encodeURIComponent(id)}`, body);
    toast.success('Role updated');
    router.push('/admin/roles');
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1>Edit role</h1>
      </div>
      {initial ? (
        <RoleForm
          initial={initial}
          submitLabel="Save changes"
          busyLabel="Saving…"
          onSubmit={onSubmit}
        />
      ) : (
        <p>Loading…</p>
      )}
    </>
  );
}
