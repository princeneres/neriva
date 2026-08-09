'use client';

import { Alert, Button, Group, Stack, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';
import { ApiError } from '../../../lib/api';

export interface SiteFormValues {
  name: string;
  slug: string;
  description: string;
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FIELD_NAMES = ['name', 'slug', 'description'] as const;

// Turn a free-text name into a URL-friendly slug suggestion.
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export function SiteForm({
  initial,
  submitLabel,
  suggestSlug = false,
  onSubmit,
}: {
  initial?: SiteFormValues;
  submitLabel: string;
  suggestSlug?: boolean;
  onSubmit: (values: SiteFormValues) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);

  const form = useForm<SiteFormValues>({
    initialValues: initial ?? { name: '', slug: '', description: '' },
    validate: {
      name: (value) => (value.trim() ? null : 'Give the site a name'),
      slug: (value) =>
        SLUG_PATTERN.test(value)
          ? null
          : 'Use lowercase letters and numbers, with hyphens between words (like my-site)',
    },
  });

  async function handleSubmit(values: SiteFormValues) {
    setBusy(true);
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      // class-validator messages start with the property name ("slug must match ...").
      const problemErrors = err instanceof ApiError ? (err.problem.errors ?? []) : [];
      const unmatched: string[] = [];
      for (const message of problemErrors) {
        const field = FIELD_NAMES.find((name) => message.toLowerCase().startsWith(name));
        if (field) {
          form.setFieldError(field, message);
        } else {
          unmatched.push(message);
        }
      }
      if (unmatched.length > 0) {
        setFormError(unmatched.join(' '));
      } else if (problemErrors.length === 0) {
        setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
      }
      setBusy(false);
    }
  }

  return (
    <form onSubmit={form.onSubmit((values) => void handleSubmit(values))}>
      <Stack gap="md">
        {formError ? (
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            {formError}
          </Alert>
        ) : null}
        <TextInput
          label="Name"
          placeholder="My website"
          required
          maxLength={255}
          data-autofocus
          {...form.getInputProps('name')}
          onChange={(event) => {
            const value = event.currentTarget.value;
            form.setFieldValue('name', value);
            if (suggestSlug && !slugEdited) {
              form.setFieldValue('slug', slugify(value));
            }
          }}
        />
        <TextInput
          label="Slug"
          placeholder="my-website"
          description="The short name used in the site's web address, like example.com/my-website. Lowercase letters, numbers, and hyphens only."
          required
          maxLength={100}
          {...form.getInputProps('slug')}
          onChange={(event) => {
            setSlugEdited(true);
            form.setFieldValue('slug', event.currentTarget.value);
          }}
        />
        <Textarea
          label="Description"
          placeholder="What is this site for?"
          description="Optional note to help your team recognize this site."
          rows={3}
          {...form.getInputProps('description')}
        />
        <Group mt="xs">
          <Button type="submit" loading={busy}>
            {submitLabel}
          </Button>
          <Button component={Link} href="/admin/sites" variant="subtle" color="slate">
            Cancel
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
