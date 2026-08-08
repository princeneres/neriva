'use client';

import { Alert, Box, Card, Code, Group, Skeleton, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle } from '@tabler/icons-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { HelpTip } from '../../../../components/help-tip';
import { ApiError, api } from '../../../../lib/api';
import { SiteForm, type SiteFormValues } from '../site-form';
import type { Site } from '../types';

export default function EditSitePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [site, setSite] = useState<Site | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: Site }>(`/sites/${id}`)
      .then(({ data }) => setSite(data))
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : 'Could not load the site.');
      });
  }, [id]);

  async function handleSubmit(values: SiteFormValues) {
    const description = values.description.trim();
    await api.patch<{ data: Site }>(`/sites/${id}`, {
      name: values.name.trim(),
      slug: values.slug,
      description: description === '' ? null : description,
    });
    notifications.show({ color: 'green', message: 'Site updated.' });
    router.push('/admin/sites');
  }

  return (
    <Box maw={640}>
      <Title order={1} fz="h2">
        Edit site
      </Title>
      <Text c="slate.5" mb="lg">
        Change the site&apos;s name, address, or description.
      </Text>

      {loadError ? (
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          {loadError}
        </Alert>
      ) : null}

      {!site && !loadError ? (
        <Card padding="xl">
          <Stack gap="lg">
            <Skeleton height={36} radius="md" />
            <Skeleton height={36} radius="md" />
            <Skeleton height={72} radius="md" />
          </Stack>
        </Card>
      ) : null}

      {site ? (
        <>
          <Card padding="xl" mb="md">
            <SiteForm
              initial={{
                name: site.name,
                slug: site.slug,
                description: site.description ?? '',
              }}
              submitLabel="Save changes"
              onSubmit={handleSubmit}
            />
          </Card>

          <Card padding="lg" bg="slate.0">
            <Text size="sm" fw={600} mb="xs">
              Record details
            </Text>
            <Stack gap={6}>
              <Group gap="xs" wrap="nowrap">
                <Text size="sm" c="slate.5" w={140} style={{ flexShrink: 0 }}>
                  ID
                </Text>
                <Code>{site.id}</Code>
              </Group>
              <Group gap="xs" wrap="nowrap">
                <Text size="sm" c="slate.5" w={140} style={{ flexShrink: 0 }}>
                  Reference code
                  <HelpTip label="A stable code other systems can use to find this site, for example during imports or migrations. It never changes when the site is renamed." />
                </Text>
                <Code>{site.externalReferenceCode}</Code>
              </Group>
            </Stack>
          </Card>
        </>
      ) : null}
    </Box>
  );
}
