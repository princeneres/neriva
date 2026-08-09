'use client';

import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Code,
  Group,
  Skeleton,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconExternalLink, IconRocket } from '@tabler/icons-react';
import { useParams } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { ApiError, api } from '../../../../lib/api';
import { publicPageUrl, useSite } from '../../../../lib/site-context';
import { PageForm, type PageFormValues } from '../page-form';
import { type Page, statusColor } from '../types';

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

export default function EditPagePage() {
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

  async function onSubmit(values: PageFormValues) {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.patch<{ data: Page }>(`/pages/${id}`, values);
      setPage(data);
      notifications.show({
        color: 'green',
        message: successMessage('Page saved.', viewUrlFor(data)),
      });
    } catch (err) {
      // Tree validation 400s carry node pointers in the problem errors;
      // they render in the Alert at the top of the form.
      setError(
        err instanceof ApiError ? err : new ApiError({ status: 0, detail: 'Request failed' }),
      );
    } finally {
      setBusy(false);
    }
  }

  function confirmPublish(current: Page) {
    modals.openConfirmModal({
      title: 'Publish page',
      children: (
        <Text size="sm">
          Publish &quot;{current.title}&quot;? It becomes visible to visitors at{' '}
          <Code>{current.path}</Code>. Unsaved changes in the editor are not included; save first if
          you made edits.
        </Text>
      ),
      labels: { confirm: 'Publish', cancel: 'Not yet' },
      onConfirm: () => void publish(),
    });
  }

  async function publish() {
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
      setError(
        err instanceof ApiError ? err : new ApiError({ status: 0, detail: 'Request failed' }),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box maw={1120}>
      <Group justify="space-between" mb="lg" align="flex-start">
        <Box>
          <Group gap="sm">
            <Title order={1} fz="h2">
              {page ? page.title : 'Edit page'}
            </Title>
            {page ? <Badge color={statusColor(page.status)}>{page.status}</Badge> : null}
          </Group>
          {page ? (
            <Text size="xs" c="slate.4" mt={4}>
              ID <Code>{page.id}</Code> · Reference <Code>{page.externalReferenceCode}</Code>
            </Text>
          ) : null}
        </Box>
        {page ? (
          <Group gap="xs">
            {page.status === 'PUBLISHED' && siteSlug !== null ? (
              <Tooltip label="View the live page in a new tab">
                <ActionIcon
                  variant="light"
                  size="lg"
                  component="a"
                  href={publicPageUrl(siteSlug, page.path)}
                  target="_blank"
                  rel="noopener"
                  aria-label="View the live page"
                >
                  <IconExternalLink size={17} />
                </ActionIcon>
              </Tooltip>
            ) : null}
            <Button
              variant="light"
              leftSection={<IconRocket size={16} />}
              disabled={busy}
              onClick={() => confirmPublish(page)}
            >
              Publish
            </Button>
          </Group>
        ) : null}
      </Group>

      {loadError !== null ? (
        <Alert color="red" icon={<IconAlertCircle size={16} />} title="Could not load the page">
          {loadError}
        </Alert>
      ) : null}
      {!page && loadError === null ? (
        <Stack gap="md">
          <Skeleton height={96} radius="lg" />
          <Skeleton height={240} radius="lg" />
        </Stack>
      ) : null}
      {page ? (
        <PageForm
          initial={{ title: page.title, path: page.path, tree: page.tree }}
          busy={busy}
          serverError={error}
          submitLabel="Save changes"
          siteSlug={siteSlug}
          onSubmit={onSubmit}
        />
      ) : null}
    </Box>
  );
}
