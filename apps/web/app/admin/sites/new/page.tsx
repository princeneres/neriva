'use client';

import { Box, Card, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api';
import { SiteForm, type SiteFormValues } from '../site-form';
import type { Site } from '../types';

export default function NewSitePage() {
  const router = useRouter();

  async function handleSubmit(values: SiteFormValues) {
    const description = values.description.trim();
    await api.post<{ data: Site }>('/sites', {
      name: values.name.trim(),
      slug: values.slug,
      ...(description ? { description } : {}),
    });
    notifications.show({ color: 'green', message: `Site "${values.name.trim()}" was created.` });
    router.push('/admin/sites');
  }

  return (
    <Box maw={640}>
      <Title order={1} fz="h2">
        New site
      </Title>
      <Text c="slate.5" mb="lg">
        A site groups your pages and content under one address.
      </Text>
      <Card padding="xl">
        <SiteForm submitLabel="Create site" suggestSlug onSubmit={handleSubmit} />
      </Card>
    </Box>
  );
}
