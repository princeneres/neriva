'use client';

import { Alert, Anchor, Box, Group, Skeleton, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle } from '@tabler/icons-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { ApiError, api } from '../../../../../lib/api';
import { publicPageUrl, useSite } from '../../../../../lib/site-context';
import { PageStudio, type PageStudioValues } from '../../page-studio';
import type { Page } from '../../types';

// Success message with a direct link to the live page when there is one.
function successMessage(text: string, viewUrl: string | null): ReactNode {
  if (viewUrl === null) {
    return text;
  }
  return (
    <Group gap="xs">
      <Text size="sm">{text}</Text>
      <Anchor size="sm" fw={600} href={viewUrl} target="_blank" rel="noopener">
        View page
      </Anchor>
    </Group>
  );
}

// Edit mode of a page: the studio owns the whole screen. Page configuration
// (title, path, publishing, deletion) lives one level up in the settings.
export default function DesignPagePage() {
  const { id } = useParams<{ id: string }>();
  const { sites } = useSite();
  const [page, setPage] = useState<Page | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    api
      .get<{ data: Page }>(`/pages/${id}`)
      .then(({ data }) => setPage(data))
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load the page');
      });
  }, [id]);

  const siteSlug = page ? (sites.find((site) => site.id === page.siteId)?.slug ?? null) : null;

  function viewUrlFor(current: Page): string | null {
    const slug = sites.find((site) => site.id === current.siteId)?.slug ?? null;
    if (slug === null || current.status !== 'PUBLISHED') {
      return null;
    }
    return publicPageUrl(slug, current.path);
  }

  function reportError(err: unknown, title: string) {
    const apiError =
      err instanceof ApiError ? err : new ApiError({ status: 0, detail: 'Request failed' });
    // Tree validation 400s carry node pointers in the problem errors; they
    // also render in the Alert inside the studio inspector.
    setError(apiError);
    notifications.show({
      color: 'red',
      title,
      message: apiError.message,
      autoClose: 10000,
    });
  }

  async function onSave(values: PageStudioValues) {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.patch<{ data: Page }>(`/pages/${id}`, {
        ...values,
        expectedUpdatedAt: page?.updatedAt,
      });
      setPage(data);
      notifications.show({
        color: 'green',
        message: successMessage('Page saved.', viewUrlFor(data)),
      });
    } catch (err) {
      reportError(err, 'The page could not be saved');
    } finally {
      setBusy(false);
    }
  }

  async function onPublish() {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post<{ data: Page }>(`/pages/${id}/publish`);
      setPage(data);
      notifications.show({
        color: 'green',
        message: successMessage('Page published.', viewUrlFor(data)),
      });
    } catch (err) {
      reportError(err, 'The page could not be published');
    } finally {
      setBusy(false);
    }
  }

  if (loadError !== null) {
    return (
      <Box maw={640}>
        <Alert color="red" icon={<IconAlertCircle size={16} />} title="Could not load the page">
          <Text size="sm">{loadError}</Text>
          <Anchor component={Link} href="/admin/pages" size="sm" fw={600}>
            Back to pages
          </Anchor>
        </Alert>
      </Box>
    );
  }

  if (page === null) {
    return (
      <Stack gap="md">
        <Skeleton height={44} radius="md" />
        <Skeleton height={420} radius="lg" />
      </Stack>
    );
  }

  return (
    <PageStudio
      key={page.id}
      initial={{ title: page.title, path: page.path, tree: page.tree }}
      status={page.status}
      pageMeta={{ id: page.id, externalReferenceCode: page.externalReferenceCode }}
      settingsHref={`/admin/pages/${page.id}`}
      siteSlug={siteSlug}
      busy={busy}
      serverError={error}
      viewUrl={viewUrlFor(page)}
      onSave={(values) => void onSave(values)}
      onPublish={() => void onPublish()}
    />
  );
}
