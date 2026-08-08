'use client';

import { Group, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { components } from '@neriva/contracts';
import { useRouter } from 'next/navigation';
import { HelpTip } from '../../../../components/help-tip';
import { api } from '../../../../lib/api';
import { ContentTypeForm, type ContentTypeFormValues } from '../content-type-form';
import { CONTENT_TYPE_HELP, type ContentType } from '../types';

type CreateContentTypeDto = components['schemas']['CreateContentTypeDto'];

export default function NewContentTypePage() {
  const router = useRouter();

  async function onSubmit(values: ContentTypeFormValues) {
    const body: CreateContentTypeDto = {
      name: values.name,
      ...(values.description.trim() ? { description: values.description.trim() } : {}),
      fields: values.fields,
    };
    await api.post<{ data: ContentType }>('/content-types', body);
    notifications.show({ color: 'green', message: 'Content type created' });
    router.push('/admin/content');
  }

  return (
    <>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={1} fz="h2">
            New content type
            <HelpTip label={CONTENT_TYPE_HELP} />
          </Title>
          <Text c="slate.5">
            Name the type and add the fields editors will fill in for each entry.
          </Text>
        </div>
      </Group>
      <ContentTypeForm
        submitLabel="Create content type"
        busyLabel="Creating…"
        onSubmit={onSubmit}
      />
    </>
  );
}
