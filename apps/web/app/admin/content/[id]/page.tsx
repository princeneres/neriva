'use client';

import { Alert, Card, Code, Group, Skeleton, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { components } from '@neriva/contracts';
import { IconAlertCircle } from '@tabler/icons-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { HelpTip } from '../../../../components/help-tip';
import { ApiError, api } from '../../../../lib/api';
import { ContentTypeForm, type ContentTypeFormValues } from '../content-type-form';
import { CONTENT_TYPE_HELP, type ContentType } from '../types';

type UpdateContentTypeDto = components['schemas']['UpdateContentTypeDto'];

export default function EditContentTypePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [contentType, setContentType] = useState<ContentType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: ContentType }>(`/content-types/${encodeURIComponent(id)}`)
      .then(({ data }) => setContentType(data))
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load content type');
      });
  }, [id]);

  async function onSubmit(values: ContentTypeFormValues) {
    const body: UpdateContentTypeDto = {
      name: values.name,
      description: values.description.trim(),
      fields: values.fields,
    };
    await api.patch<{ data: ContentType }>(`/content-types/${encodeURIComponent(id)}`, body);
    notifications.show({ color: 'green', message: 'Content type updated' });
    router.push('/admin/content');
  }

  return (
    <>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={1} fz="h2">
            Edit content type
            <HelpTip label={CONTENT_TYPE_HELP} />
          </Title>
          <Text c="slate.5">
            Changing fields does not update existing entries; they keep their saved values.
          </Text>
        </div>
      </Group>

      {loadError ? (
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          {loadError}
        </Alert>
      ) : contentType ? (
        <Stack gap="lg">
          <ContentTypeForm
            initial={{
              name: contentType.name,
              description: contentType.description ?? '',
              fields: contentType.fields,
            }}
            submitLabel="Save changes"
            busyLabel="Saving…"
            onSubmit={onSubmit}
          />
          <Card padding="md" bg="slate.0" maw={860}>
            <Text size="sm" fw={600} mb={4}>
              Details
              <HelpTip label="Read-only identifiers, useful for the API and migrations" />
            </Text>
            <Stack gap={4}>
              <Group gap="xs">
                <Text size="sm" c="slate.5" w={140}>
                  ID
                </Text>
                <Code>{contentType.id}</Code>
              </Group>
              <Group gap="xs">
                <Text size="sm" c="slate.5" w={140}>
                  Reference code
                </Text>
                <Code>{contentType.externalReferenceCode}</Code>
              </Group>
              <Group gap="xs">
                <Text size="sm" c="slate.5" w={140}>
                  Created
                </Text>
                <Text size="sm">{new Date(contentType.createdAt).toLocaleString()}</Text>
              </Group>
              <Group gap="xs">
                <Text size="sm" c="slate.5" w={140}>
                  Updated
                </Text>
                <Text size="sm">{new Date(contentType.updatedAt).toLocaleString()}</Text>
              </Group>
            </Stack>
          </Card>
        </Stack>
      ) : (
        <Stack gap="sm" maw={860}>
          <Skeleton height={56} radius="md" />
          <Skeleton height={80} radius="md" />
          <Skeleton height={120} radius="md" />
        </Stack>
      )}
    </>
  );
}
