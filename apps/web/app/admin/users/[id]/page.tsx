'use client';

import type { components } from '@neriva/contracts';
import { useRouter } from 'next/navigation';
import { type FormEvent, use, useEffect, useState } from 'react';
import { Button, Field, FormActions } from '../../../../components/form';
import { useToast } from '../../../../components/toast';
import { ApiError, api, type PublicUser } from '../../../../lib/api';

type Role = components['schemas']['RoleDto'];
type UpdateUserDto = components['schemas']['UpdateUserDto'];

function fieldError(errors: string[] | undefined, field: string): string | null {
  return errors?.find((message) => message.toLowerCase().startsWith(field.toLowerCase())) ?? null;
}

export default function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleId, setRoleId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [roleBusy, setRoleBusy] = useState(false);

  useEffect(() => {
    api
      .get<{ data: PublicUser }>(`/users/${encodeURIComponent(id)}`)
      .then(({ data }) => {
        setEmail(data.email);
        setDisplayName(data.displayName);
        setLoaded(true);
      })
      .catch((err: unknown) => {
        toast.error(err instanceof ApiError ? err.message : 'Failed to load user');
      });
    api
      .get<{ data: Role[] }>('/roles?limit=100')
      .then(({ data }) => setRoles(data))
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          toast.error(err.message);
        }
      });
  }, [id, toast]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors([]);
    const body: UpdateUserDto = { email, displayName };
    try {
      await api.patch<{ data: PublicUser }>(`/users/${encodeURIComponent(id)}`, body);
      toast.success('User updated');
      router.push('/admin/users');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.problem.errors ?? []);
      } else {
        setError('User update failed');
      }
      setBusy(false);
    }
  }

  async function onAssignRole() {
    if (!roleId) {
      return;
    }
    setRoleBusy(true);
    try {
      await api.post(`/users/${encodeURIComponent(id)}/roles`, { roleId });
      toast.success('Role assigned');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Role assignment failed');
    } finally {
      setRoleBusy(false);
    }
  }

  async function onUnassignRole() {
    if (!roleId) {
      return;
    }
    setRoleBusy(true);
    try {
      await api.del(`/users/${encodeURIComponent(id)}/roles/${encodeURIComponent(roleId)}`);
      toast.success('Role unassigned');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Role unassignment failed');
    } finally {
      setRoleBusy(false);
    }
  }

  if (!loaded) {
    return (
      <>
        <div className="nv-toolbar">
          <h1>Edit user</h1>
        </div>
        <p>Loading…</p>
      </>
    );
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1>Edit user</h1>
      </div>
      <form className="nv-form" onSubmit={onSubmit}>
        {error ? <div className="nv-error">{error}</div> : null}
        <Field label="Email" htmlFor="email" error={fieldError(fieldErrors, 'email')}>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field
          label="Display name"
          htmlFor="displayName"
          error={fieldError(fieldErrors, 'displayName')}
        >
          <input
            id="displayName"
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </Field>
        <FormActions>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push('/admin/users')}>
            Cancel
          </Button>
        </FormActions>
      </form>
      <div className="nv-card" style={{ marginTop: 'var(--nv-space-5)', maxWidth: 560 }}>
        <div className="nv-card-body">
          <h2 style={{ marginTop: 0, fontSize: 'var(--nv-text-md)' }}>Roles</h2>
          <p style={{ color: 'var(--nv-color-neutral-500)', fontSize: 'var(--nv-text-sm)' }}>
            The API does not expose a user&apos;s current role assignments yet, so they cannot be
            listed here. Assigning an already assigned role or unassigning a role that is not
            assigned is harmless.
          </p>
          <div className="nv-form">
            <Field label="Role" htmlFor="assignRoleId">
              <select id="assignRoleId" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                <option value="">Select a role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </Field>
            <FormActions>
              <Button
                type="button"
                disabled={roleBusy || !roleId}
                onClick={() => void onAssignRole()}
              >
                Assign
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={roleBusy || !roleId}
                onClick={() => void onUnassignRole()}
              >
                Unassign
              </Button>
            </FormActions>
          </div>
        </div>
      </div>
    </>
  );
}
