'use client';

import { Alert, Anchor, Box, Skeleton, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle } from '@tabler/icons-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError, api } from '../../../../lib/api';
import { TemplateStudio, type TemplateStudioValues } from '../template-studio';
import type { PageTemplate } from '../types';

// Edit mode of a page template: the studio owns the whole screen, same as
// the page editor's design route (spec 14 section 4), minus page settings.
export default function PageTemplateEditPage() {
  const { id } = useParams<{ id: string }>();
  const [template, setTemplate] = useState<PageTemplate | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [settingDefault, setSettingDefault] = useState(false);

  useEffect(() => {
    api
      .get<{ data: PageTemplate }>(`/page-templates/${id}`)
      .then(({ data }) => setTemplate(data))
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load the template');
      });
  }, [id]);

  async function onSave(values: TemplateStudioValues) {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.patch<{ data: PageTemplate }>(`/page-templates/${id}`, {
        ...values,
        expectedUpdatedAt: template?.updatedAt,
      });
      setTemplate(data);
      notifications.show({ color: 'green', message: 'Template saved.' });
    } catch (err) {
      const apiError =
        err instanceof ApiError ? err : new ApiError({ status: 0, detail: 'Request failed' });
      setError(apiError);
      notifications.show({
        color: 'red',
        title: 'The template could not be saved',
        message: apiError.message,
        autoClose: 10000,
      });
    } finally {
      setBusy(false);
    }
  }

  async function onSetDefault() {
    setSettingDefault(true);
    try {
      const { data } = await api.post<{ data: PageTemplate }>(`/page-templates/${id}/set-default`);
      setTemplate(data);
      notifications.show({ color: 'green', message: `"${data.name}" is now the default master.` });
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Could not set the default master',
        message: err instanceof ApiError ? err.message : 'Request failed',
      });
    } finally {
      setSettingDefault(false);
    }
  }

  if (loadError !== null) {
    return (
      <Box maw={640}>
        <Alert color="red" icon={<IconAlertCircle size={16} />} title="Could not load the template">
          <Text size="sm">{loadError}</Text>
          <Anchor component={Link} href="/admin/page-templates" size="sm" fw={600}>
            Back to page templates
          </Anchor>
        </Alert>
      </Box>
    );
  }

  if (template === null) {
    return (
      <Stack gap="md">
        <Skeleton height={44} radius="md" />
        <Skeleton height={420} radius="lg" />
      </Stack>
    );
  }

  return (
    <TemplateStudio
      key={template.id}
      kind={template.kind}
      initialName={template.name}
      initialTree={template.tree}
      backHref="/admin/page-templates"
      busy={busy}
      serverError={error}
      onSave={(values) => void onSave(values)}
      isDefault={template.isDefault}
      settingDefault={settingDefault}
      onSetDefault={() => void onSetDefault()}
    />
  );
}
