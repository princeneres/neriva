'use client';

import { Alert, Anchor, Box, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ApiError, api } from '../../../../lib/api';
import { useSite } from '../../../../lib/site-context';
import { PageForm, type PageFormValues } from '../page-form';
import type { Page } from '../types';

function NewPageForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sites } = useSite();
  const siteId = searchParams.get('site');
  const siteSlug = sites.find((site) => site.id === siteId)?.slug ?? null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  if (siteId === null || siteId === '') {
    return (
      <Alert color="yellow" icon={<IconAlertCircle size={16} />} title="Pick a site first">
        Every page lives inside a site. Go back to{' '}
        <Anchor component={Link} href="/admin/pages">
          Pages
        </Anchor>{' '}
        and choose one.
      </Alert>
    );
  }

  async function onSubmit(values: PageFormValues) {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post<{ data: Page }>(`/sites/${siteId}/pages`, values);
      notifications.show({ color: 'green', message: `"${data.title}" was created.` });
      router.push(`/admin/pages/${data.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError({ status: 0, detail: 'Request failed' }),
      );
      setBusy(false);
    }
  }

  return (
    <PageForm
      busy={busy}
      serverError={error}
      submitLabel="Create page"
      siteSlug={siteSlug}
      onSubmit={onSubmit}
    />
  );
}

export default function NewPagePage() {
  return (
    <Box maw={1120}>
      <Box mb="lg">
        <Title order={1} fz="h2">
          New page
        </Title>
        <Text c="slate.5">
          Give the page a title and an address, then stack blocks to build it.
        </Text>
      </Box>
      <Suspense fallback={null}>
        <NewPageForm />
      </Suspense>
    </Box>
  );
}
