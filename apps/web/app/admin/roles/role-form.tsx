'use client';

import {
  ActionIcon,
  Alert,
  Autocomplete,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';
import { HelpTip } from '../../../components/help-tip';
import { ApiError } from '../../../lib/api';
import type { Permission } from './shared';

export interface RoleFormValues {
  name: string;
  description: string;
  permissions: Permission[];
}

// Suggested values; the API also accepts any lowercase identifier, so the
// inputs are autocompletes rather than closed selects.
const RESOURCE_SUGGESTIONS = [
  '*',
  'site',
  'page',
  'block',
  'content-type',
  'content-entry',
  'object-definition',
  'object-record',
  'style-book',
  'user',
  'role',
  'system-setting',
];

const ACTION_SUGGESTIONS = ['*', 'create', 'read', 'update', 'delete', 'publish'];

// Allowed values per the API: '*' or a lowercase identifier such as 'page' or 'content-entry'.
const PERMISSION_PART_PATTERN = /^(\*|[a-z][a-z-]*)$/;
const PERMISSION_PART_HINT = 'Use * or lowercase letters and dashes (e.g. content-entry)';

export function RoleForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: RoleFormValues;
  submitLabel: string;
  onSubmit: (values: RoleFormValues) => Promise<void>;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const form = useForm<RoleFormValues>({
    initialValues: {
      name: initial?.name ?? '',
      description: initial?.description ?? '',
      permissions: initial?.permissions.map((permission) => ({ ...permission })) ?? [],
    },
    validate: {
      name: (value) => (value.trim() ? null : 'Enter a name'),
      permissions: {
        resourceType: (value) =>
          PERMISSION_PART_PATTERN.test(value) ? null : PERMISSION_PART_HINT,
        action: (value) => (PERMISSION_PART_PATTERN.test(value) ? null : PERMISSION_PART_HINT),
      },
    },
  });

  async function handleSubmit(values: RoleFormValues) {
    setBusy(true);
    setFormError(null);
    try {
      await onSubmit({
        name: values.name,
        description: values.description,
        permissions: values.permissions.map((permission) => ({
          resourceType: permission.resourceType,
          action: permission.action,
        })),
      });
    } catch (err) {
      if (err instanceof ApiError) {
        const nameError = err.problem.errors?.find((message) =>
          message.toLowerCase().startsWith('name'),
        );
        if (nameError) {
          form.setFieldError('name', nameError);
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError('Saving the role failed. Please try again.');
      }
      setBusy(false);
    }
  }

  return (
    <Card padding="xl">
      <form onSubmit={form.onSubmit((values) => void handleSubmit(values))}>
        <Stack gap="md">
          {formError ? <Alert color="red">{formError}</Alert> : null}
          <TextInput
            label="Name"
            placeholder="Editor"
            description="A short name users will recognize, like Editor or Publisher"
            required
            {...form.getInputProps('name')}
          />
          <Textarea
            label="Description"
            placeholder="Can write and edit content, but not publish it"
            description="Optional, helps others understand what this role is for"
            rows={2}
            {...form.getInputProps('description')}
          />

          <div>
            <Group gap={4} mb={2}>
              <Text component="label" size="sm" fw={500}>
                Permissions
              </Text>
              <HelpTip label="Neriva denies everything by default: users can only do what a role explicitly grants. Each row grants one action on one kind of resource; * means all." />
            </Group>
            <Text size="xs" c="slate.5" mb="sm">
              Pick a suggestion or type your own value. Use * to grant every resource or every
              action.
            </Text>
            <Stack gap="xs">
              {form.values.permissions.map((permission, index) => (
                // Permission rows have no stable identity; index keys are safe
                // because rows are only appended or removed via the buttons.
                <Group key={index} gap="xs" align="flex-start" wrap="nowrap">
                  <Autocomplete
                    aria-label="Resource"
                    placeholder="Resource (e.g. page)"
                    data={RESOURCE_SUGGESTIONS}
                    flex={1}
                    {...form.getInputProps(`permissions.${index}.resourceType`)}
                  />
                  <Autocomplete
                    aria-label="Action"
                    placeholder="Action (e.g. read)"
                    data={ACTION_SUGGESTIONS}
                    flex={1}
                    {...form.getInputProps(`permissions.${index}.action`)}
                  />
                  <Tooltip label="Remove this permission">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      mt={4}
                      aria-label="Remove permission"
                      onClick={() => form.removeListItem('permissions', index)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              ))}
              <div>
                <Button
                  variant="light"
                  size="xs"
                  leftSection={<IconPlus size={14} />}
                  onClick={() =>
                    form.insertListItem('permissions', { resourceType: '', action: '' })
                  }
                >
                  Add permission
                </Button>
              </div>
            </Stack>
          </div>

          <Group mt="xs">
            <Button type="submit" loading={busy}>
              {submitLabel}
            </Button>
            <Button component={Link} href="/admin/roles" variant="subtle" color="gray">
              Cancel
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
}
