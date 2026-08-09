'use client';

import {
  Alert,
  Badge,
  Box,
  Button,
  Code,
  Group,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconRocket } from '@tabler/icons-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError, api } from '../../../../lib/api';
import { PageForm, type PageFormValues } from '../page-form';
import { type Page, statusColor } from '../types';

export default function EditPagePage() {
  const { id } = useParams<{ id: string }>();
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

  async function onSubmit(values: PageFormValues) {
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.patch<{ data: Page }>(`/pages/${id}`, values);
      setPage(data);
      notifications.show({ color: 'green', message: 'Page saved.' });
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
      notifications.show({ color: 'green', message: 'Page published.' });
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError({ status: 0, detail: 'Request failed' }),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box maw={860}>
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
          <Button
            variant="light"
            leftSection={<IconRocket size={16} />}
            disabled={busy}
            onClick={() => confirmPublish(page)}
          >
            Publish
          </Button>
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
          onSubmit={onSubmit}
        />
      ) : null}
    </Box>
  );
}
