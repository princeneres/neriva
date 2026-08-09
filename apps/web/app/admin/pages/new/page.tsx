'use client';

import {
  Alert,
  Anchor,
  Box,
  Button,
  Card,
  Group,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconBrush } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { HelpTip } from '../../../../components/help-tip';
import { ApiError, api } from '../../../../lib/api';
import { useSite } from '../../../../lib/site-context';
import { PATH_PATTERN } from '../tree-utils';
import type { Page } from '../types';

const PATH_ERROR =
  'The path must start with "/" and use only lowercase letters, digits, "/" and "-".';

interface NewPageValues {
  title: string;
  path: string;
}

const FIELD_NAMES = ['title', 'path'] as const;

// Creating a page is a small form: name it and give it an address. On
// success the user lands straight in the studio to design the content.
function NewPageForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sites, current, loading } = useSite();
  const siteParam = searchParams.get('site');
  // ?site= wins when present; otherwise fall back to the globally selected site.
  const site =
    siteParam !== null && siteParam !== ''
      ? (sites.find((candidate) => candidate.id === siteParam) ?? null)
      : current;
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<NewPageValues>({
    initialValues: { title: '', path: '/' },
    validate: {
      title: (value) => (value.trim() ? null : 'Give the page a title'),
      path: (value) => (PATH_PATTERN.test(value) ? null : PATH_ERROR),
    },
  });

  if (loading) {
    return (
      <Box maw={640}>
        <Stack gap="md">
          <Skeleton height={36} width={220} radius="md" />
          <Skeleton height={220} radius="lg" />
        </Stack>
      </Box>
    );
  }

  if (site === null) {
    return (
      <Box maw={640}>
        <Alert color="yellow" icon={<IconAlertCircle size={16} />} title="Pick a site first">
          Every page lives inside a site. Go back to{' '}
          <Anchor component={Link} href="/admin/pages">
            Pages
          </Anchor>{' '}
          and choose one.
        </Alert>
      </Box>
    );
  }

  async function handleSubmit(values: NewPageValues) {
    setBusy(true);
    setFormError(null);
    try {
      const { data } = await api.post<{ data: Page }>(`/sites/${site?.id}/pages`, {
        title: values.title.trim(),
        path: values.path,
      });
      notifications.show({ color: 'green', message: `"${data.title}" was created.` });
      router.push(`/admin/pages/${data.id}/design`);
    } catch (err) {
      // class-validator messages start with the property name ("path must match ...").
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
    <Box maw={640}>
      <Title order={1} fz="h2">
        New page
      </Title>
      <Text c="slate.5" mb="lg">
        Name the page and pick its address in &quot;{site.name}&quot;. You design the content right
        after.
      </Text>

      <Card padding="xl">
        <form onSubmit={form.onSubmit((values) => void handleSubmit(values))}>
          <Stack gap="md">
            {formError ? (
              <Alert color="red" icon={<IconAlertCircle size={16} />}>
                {formError}
              </Alert>
            ) : null}
            <TextInput
              label="Title"
              description="The name of the page, shown in menus and browser tabs."
              placeholder="About us"
              required
              maxLength={255}
              data-autofocus
              {...form.getInputProps('title')}
            />
            <TextInput
              label={
                <>
                  Path
                  <HelpTip label="The address of the page inside its site, for example /about. Only lowercase letters, digits, / and - are allowed." />
                </>
              }
              description="Where the page lives, for example /about."
              placeholder="/about"
              required
              maxLength={255}
              {...form.getInputProps('path')}
            />
            <Group mt="xs">
              <Button type="submit" loading={busy} leftSection={<IconBrush size={16} />}>
                Create and design
              </Button>
              <Button component={Link} href="/admin/pages" variant="subtle" color="slate">
                Cancel
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </Box>
  );
}

export default function NewPagePage() {
  return (
    <Suspense fallback={null}>
      <NewPageForm />
    </Suspense>
  );
}
