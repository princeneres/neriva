'use client';

import {
  Alert,
  Anchor,
  Button,
  Card,
  Code,
  Group,
  JsonInput,
  Skeleton,
  Text,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { HelpTip } from '../../../../components/help-tip';
import { ApiError, api } from '../../../../lib/api';
import {
  type SystemSetting,
  VALUE_DESCRIPTION,
  parseValueInput,
  splitFieldErrors,
} from '../shared';

function EditSettingForm({ setting }: { setting: SystemSetting }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const form = useForm({
    initialValues: { value: JSON.stringify(setting.value, null, 2) },
    validate: {
      value: (value) => (value.trim() === '' ? 'Value is required' : null),
    },
  });

  async function onSubmit(values: { value: string }) {
    setFormError(null);
    setBusy(true);
    try {
      await api.put(`/system/settings/${encodeURIComponent(setting.key)}`, {
        value: parseValueInput(values.value),
      });
      notifications.show({ color: 'green', message: `Setting "${setting.key}" saved` });
      router.push('/admin/settings');
    } catch (error) {
      if (error instanceof ApiError) {
        const fields = splitFieldErrors(error.problem.errors);
        if (fields.value) {
          form.setFieldError('value', fields.value);
        }
        if (fields.other.length > 0) {
          setFormError(fields.other.join('. '));
        } else if (!fields.value) {
          setFormError(error.message);
        }
      } else {
        setFormError('Request failed');
      }
      setBusy(false);
    }
  }

  return (
    <Group align="flex-start" gap="lg" wrap="wrap-reverse">
      <Card padding="xl" maw={640} flex="1 1 380px">
        <form onSubmit={form.onSubmit((values) => void onSubmit(values))}>
          {formError ? (
            <Alert color="red" mb="md">
              {formError}
            </Alert>
          ) : null}
          <JsonInput
            label={
              <>
                Value
                <HelpTip label="What the setting holds. It can be a single piece of text or a number, or a whole group of related values." />
              </>
            }
            description={VALUE_DESCRIPTION}
            validationError="Not valid JSON on its own, so it will be saved as plain text"
            autosize
            minRows={8}
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

      <Card padding="lg" w={280} bg="slate.0">
        <Text size="xs" fw={700} tt="uppercase" c="slate.5" lts="0.06em" mb="xs">
          Details
        </Text>
        <Text size="xs" c="slate.5">
          Key
        </Text>
        <Code mb="sm">{setting.key}</Code>
        <Text size="xs" c="slate.5">
          Last updated
        </Text>
        <Text size="sm" mb="sm">
          {new Date(setting.updatedAt).toLocaleString()}
        </Text>
        <Text size="xs" c="slate.5">
          ID
        </Text>
        <Text size="sm" ff="monospace" style={{ wordBreak: 'break-all' }}>
          {setting.id}
        </Text>
      </Card>
    </Group>
  );
}

export default function EditSettingPage() {
  // The route param is the setting KEY (e.g. smtp.host), not an entity id.
  const params = useParams<{ key: string }>();
  const key = decodeURIComponent(params.key);

  const [setting, setSetting] = useState<SystemSetting | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: SystemSetting }>(`/system/settings/${encodeURIComponent(key)}`)
      .then(({ data }) => {
        if (!cancelled) {
          setSetting(data);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof ApiError ? error.message : 'Failed to load setting');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return (
    <>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={1} fz="h2">
            Edit setting
          </Title>
          <Text c="slate.5">
            Change the value stored under <Code>{key}</Code>. The key itself cannot change.
          </Text>
        </div>
      </Group>

      {loadError ? (
        <Alert color="red" maw={640}>
          {loadError}
        </Alert>
      ) : setting ? (
        <EditSettingForm setting={setting} />
      ) : (
        <Card padding="xl" maw={640}>
          <Skeleton height={12} width="30%" mb="md" />
          <Skeleton height={140} mb="lg" />
          <Skeleton height={34} width={110} />
        </Card>
      )}
    </>
  );
}
