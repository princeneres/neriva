'use client';

import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Center,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { components } from '@neriva/contracts';
import { IconAlertCircle, IconChevronRight, IconFileText, IconPlus } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { HelpTip } from '../../../../../components/help-tip';
import { ApiError, api, type ListMeta } from '../../../../../lib/api';
import type { ContentEntry, ContentType } from '../../types';
import { EntryForm, type EntryFormValues } from '../entry-form';

type CreateContentEntryDto = components['schemas']['CreateContentEntryDto'];

function TypePicker() {
  const [contentTypes, setContentTypes] = useState<ContentType[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: ContentType[]; meta: ListMeta }>('/content-types?limit=100')
      .then(({ data }) => setContentTypes(data))
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load content types');
      });
  }, []);

  if (loadError) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={16} />}>
        {loadError}
      </Alert>
    );
  }

  if (contentTypes === null) {
    return (
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} height={110} radius="lg" />
        ))}
      </SimpleGrid>
    );
  }

  if (contentTypes.length === 0) {
    return (
      <Card padding={0}>
        <Center py={64}>
          <Stack align="center" gap="sm" maw={420}>
            <ThemeIcon variant="light" size={48} radius="xl">
              <IconFileText size={26} stroke={1.6} />
            </ThemeIcon>
            <Text ta="center" c="slate.5">
              There are no content types yet. A content type is the template an entry fills in, so
              create one first.
            </Text>
            <Button component={Link} href="/admin/content/new" leftSection={<IconPlus size={16} />}>
              New content type
            </Button>
          </Stack>
        </Center>
      </Card>
    );
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
      {contentTypes.map((contentType) => (
        <Card
          key={contentType.id}
          component={Link}
          href={`/admin/content/entries/new?type=${encodeURIComponent(contentType.id)}`}
          padding="lg"
          style={{ cursor: 'pointer' }}
        >
          <Group justify="space-between" wrap="nowrap" align="flex-start">
            <div>
              <Text fw={600}>{contentType.name}</Text>
              {contentType.description ? (
                <Text size="sm" c="slate.5" lineClamp={2} mt={2}>
                  {contentType.description}
                </Text>
              ) : null}
              <Badge color="slate" mt="sm">
                {contentType.fields.length} {contentType.fields.length === 1 ? 'field' : 'fields'}
              </Badge>
            </div>
            <IconChevronRight size={16} color="var(--mantine-color-slate-4)" />
          </Group>
        </Card>
      ))}
    </SimpleGrid>
  );
}

function NewEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeRef = searchParams.get('type');
  const [contentType, setContentType] = useState<ContentType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!typeRef) {
      setContentType(null);
      return;
    }
    api
      .get<{ data: ContentType }>(`/content-types/${encodeURIComponent(typeRef)}`)
      .then(({ data }) => setContentType(data))
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load content type');
      });
  }, [typeRef]);

  async function onSubmit(values: EntryFormValues) {
    if (!contentType) {
      return;
    }
    const body: CreateContentEntryDto = {
      contentType: contentType.id,
      title: values.title,
      values: values.values,
    };
    await api.post<{ data: ContentEntry }>('/content-entries', body);
    notifications.show({ color: 'green', message: 'Entry created' });
    router.push('/admin/content/entries');
  }

  if (!typeRef) {
    return (
      <>
        <Group justify="space-between" mb="lg">
          <div>
            <Title order={1} fz="h2">
              New entry
              <HelpTip label="An entry fills in the fields of a content type, like one article or one FAQ item" />
            </Title>
            <Text c="slate.5">First, pick the content type this entry should be based on.</Text>
          </div>
        </Group>
        <TypePicker />
      </>
    );
  }

  return (
    <>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={1} fz="h2">
            New entry{contentType ? `: ${contentType.name}` : ''}
            <HelpTip label="An entry fills in the fields of a content type, like one article or one FAQ item" />
          </Title>
          <Text c="slate.5">
            Fill in the fields defined by the type, or{' '}
            <Anchor component={Link} href="/admin/content/entries/new" size="sm">
              pick a different type
            </Anchor>
            .
          </Text>
        </div>
      </Group>
      {loadError ? (
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          {loadError}
        </Alert>
      ) : contentType ? (
        <EntryForm
          key={contentType.id}
          contentType={contentType}
          submitLabel="Create entry"
          busyLabel="Creating…"
          onSubmit={onSubmit}
        />
      ) : (
        <Stack gap="sm" maw={640}>
          <Skeleton height={56} radius="md" />
          <Skeleton height={56} radius="md" />
          <Skeleton height={96} radius="md" />
        </Stack>
      )}
    </>
  );
}

export default function NewEntryPage() {
  return (
    <Suspense
      fallback={
        <Stack gap="sm" maw={640}>
          <Skeleton height={56} radius="md" />
          <Skeleton height={96} radius="md" />
        </Stack>
      }
    >
      <NewEntry />
    </Suspense>
  );
}
