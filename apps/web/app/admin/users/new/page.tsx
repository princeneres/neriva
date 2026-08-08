'use client';

import type { components } from '@neriva/contracts';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';
import { Button, Field, FormActions } from '../../../../components/form';
import { useToast } from '../../../../components/toast';
import { ApiError, api, type PublicUser } from '../../../../lib/api';

type Role = components['schemas']['RoleDto'];
type CreateUserDto = components['schemas']['CreateUserDto'];

function fieldError(errors: string[] | undefined, field: string): string | null {
  return errors?.find((message) => message.toLowerCase().startsWith(field.toLowerCase())) ?? null;
}

export default function NewUserPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<{ data: Role[] }>('/roles?limit=100')
      .then(({ data }) => setRoles(data))
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          toast.error(err.message);
        }
      });
  }, [toast]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors([]);
    const body: CreateUserDto = {
      email,
      displayName,
      password,
      ...(roleId ? { roleIds: [roleId] } : {}),
    };
    try {
      await api.post<{ data: PublicUser }>('/users', body);
      toast.success('User created');
      router.push('/admin/users');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.problem.errors ?? []);
      } else {
        setError('User creation failed');
      }
      setBusy(false);
    }
  }

  return (
    <>
      <div className="nv-toolbar">
        <h1>New user</h1>
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
        <Field
          label="Temporary password (min 8 characters, a change is forced on first login)"
          htmlFor="password"
          error={fieldError(fieldErrors, 'password')}
        >
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label="Role (optional)" htmlFor="roleId">
          <select id="roleId" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            <option value="">No role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </Field>
        <FormActions>
          <Button type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create user'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push('/admin/users')}>
            Cancel
          </Button>
        </FormActions>
      </form>
    </>
  );
}
