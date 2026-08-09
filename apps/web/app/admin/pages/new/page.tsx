'use client';

import { Alert, Anchor, Box, Skeleton, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ApiError, api } from '../../../../lib/api';
import { useSite } from '../../../../lib/site-context';
import { PageStudio, type PageStudioValues } from '../page-studio';
import type { Page } from '../types';

function NewPageStudio() {
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
  const [error, setError] = useState<ApiError | null>(null);

  if (loading) {
    return (
      <Stack gap="md">
        <Skeleton height={44} radius="md" />
        <Skeleton height={420} radius="lg" />
      </Stack>
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

  async function onSave(values: PageStudioValues) {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post<{ data: Page }>(`/sites/${site?.id}/pages`, values);
      notifications.show({ color: 'green', message: `"${data.title}" was created.` });
      router.push(`/admin/pages/${data.id}`);
    } catch (err) {
      const apiError =
        err instanceof ApiError ? err : new ApiError({ status: 0, detail: 'Request failed' });
      setError(apiError);
      notifications.show({
        color: 'red',
        title: 'The page could not be created',
        message: apiError.message,
        autoClose: 10000,
      });
      setBusy(false);
    }
  }

  return (
    <PageStudio
      status={null}
      pageMeta={null}
      siteSlug={site.slug}
      busy={busy}
      serverError={error}
      saveLabel="Create page"
      viewUrl={null}
      onSave={(values) => void onSave(values)}
    />
  );
}

export default function NewPagePage() {
  return (
    <Suspense fallback={null}>
      <NewPageStudio />
    </Suspense>
  );
}
