'use client';

import {
  Alert,
  Anchor,
  Button,
  Card,
  Group,
  JsonInput,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { HelpTip } from '../../../../components/help-tip';
import { ApiError, api } from '../../../../lib/api';
import {
  KEY_HINT,
  KEY_PATTERN,
  VALUE_DESCRIPTION,
  parseValueInput,
  splitFieldErrors,
} from '../shared';

function NewSettingForm() {
  const router = useRouter();
  // The Common settings card links here with ?key= to pre-fill the key.
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const form = useForm({
    initialValues: {
      key: searchParams.get('key') ?? '',
      value: '',
    },
    validate: {
      key: (value) => (KEY_PATTERN.test(value) ? null : KEY_HINT),
      value: (value) => (value.trim() === '' ? 'Value is required' : null),
    },
  });

  async function onSubmit(values: { key: string; value: string }) {
    setFormError(null);
    setBusy(true);
    try {
      await api.put(`/system/settings/${encodeURIComponent(values.key)}`, {
        value: parseValueInput(values.value),
      });
      notifications.show({ color: 'green', message: `Setting "${values.key}" saved` });
      router.push('/admin/settings');
    } catch (error) {
      if (error instanceof ApiError) {
        const fields = splitFieldErrors(error.problem.errors);
        if (fields.key) {
          form.setFieldError('key', fields.key);
        }
        if (fields.value) {
          form.setFieldError('value', fields.value);
        }
        if (fields.other.length > 0) {
          setFormError(fields.other.join('. '));
        } else if (!fields.key && !fields.value) {
          setFormError(error.message);
        }
      } else {
        setFormError('Request failed');
      }
      setBusy(false);
    }
  }

  return (
    <>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={1} fz="h2">
            New setting
          </Title>
          <Text c="slate.5">
            Give it a key to look it up by, and the value the system should read.
          </Text>
        </div>
      </Group>

      <Card padding="xl" maw={640}>
        <form onSubmit={form.onSubmit((values) => void onSubmit(values))}>
          {formError ? (
            <Alert color="red" mb="md">
              {formError}
            </Alert>
          ) : null}
          <TextInput
            label={
              <>
                Key
                <HelpTip label="The unique name used to look this setting up, in the admin and through the API." />
              </>
            }
            placeholder="site.name"
            description={KEY_HINT}
            required
            mb="md"
            {...form.getInputProps('key')}
          />
          <JsonInput
            label={
              <>
                Value
                <HelpTip label="What the setting holds. It can be a single piece of text or a number, or a whole group of related values." />
              </>
            }
            placeholder='"My site" or { "host": "smtp.example.com" }'
            description={VALUE_DESCRIPTION}
            validationError="Not valid JSON on its own, so it will be saved as plain text"
            autosize
            minRows={6}
            required
            mb="lg"
            {...form.getInputProps('value')}
          />
          <Group>
            <Button type="submit" loading={busy}>
              Save
            </Button>
            <Anchor component={Link} href="/admin/settings" size="sm" c="slate.5">
              Cancel
            </Anchor>
          </Group>
        </form>
      </Card>
    </>
  );
}

export default function NewSettingPage() {
  return (
    <Suspense>
      <NewSettingForm />
    </Suspense>
  );
}
