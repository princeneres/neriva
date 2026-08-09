'use client';

import { Alert, Badge, Button, Group, Skeleton, Stack, Text, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import type { components } from '@neriva/contracts';
import { IconAlertCircle, IconSend } from '@tabler/icons-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { HelpTip } from '../../../../../components/help-tip';
import { ApiError, api } from '../../../../../lib/api';
import { STATUS_COLORS, type ContentEntry, type ContentType } from '../../types';
import { EntryForm, type EntryFormValues } from '../entry-form';

type UpdateContentEntryDto = components['schemas']['UpdateContentEntryDto'];

export default function EditEntryPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [entry, setEntry] = useState<ContentEntry | null>(null);
  const [contentType, setContentType] = useState<ContentType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ data: ContentEntry }>(`/content-entries/${encodeURIComponent(id)}`)
      .then(async ({ data }) => {
        const type = await api.get<{ data: ContentType }>(`/content-types/${data.contentTypeId}`);
        if (!cancelled) {
          setEntry(data);
          setContentType(type.data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : 'Failed to load entry');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onSubmit(values: EntryFormValues) {
    const body: UpdateContentEntryDto = {
      title: values.title,
      values: values.values,
    };
    await api.patch<{ data: ContentEntry }>(`/content-entries/${encodeURIComponent(id)}`, body);
    notifications.show({ color: 'green', message: 'Entry updated' });
    router.push('/admin/content/entries');
  }

  function confirmPublish() {
    if (!entry) {
      return;
    }
    modals.openConfirmModal({
      title: 'Publish entry',
      children: (
        <Text size="sm">
          Publish <strong>{entry.title}</strong>? Published entries are visible to the sites and
          apps that consume this content.
        </Text>
      ),
      labels: { confirm: 'Publish', cancel: 'Cancel' },
      onConfirm: () => {
        void (async () => {
          setPublishing(true);
          try {
            const { data } = await api.post<{ data: ContentEntry }>(
              `/content-entries/${encodeURIComponent(id)}/publish`,
            );
            setEntry(data);
            notifications.show({ color: 'green', message: 'Entry published' });
          } catch (error) {
            notifications.show({
              color: 'red',
              title: 'Could not publish entry',
              message: error instanceof ApiError ? error.message : 'Publishing the entry failed',
            });
          } finally {
            setPublishing(false);
          }
        })();
      },
    });
  }

  return (
    <>
      <Group justify="space-between" mb="lg">
        <div>
          <Group gap="sm" align="center">
            <Title order={1} fz="h2">
              Edit entry
            </Title>
            {entry ? <Badge color={STATUS_COLORS[entry.status]}>{entry.status}</Badge> : null}
          </Group>
          <Text c="slate.5">
            {contentType ? (
              <>
                Based on the <strong>{contentType.name}</strong> content type
                <HelpTip label="This entry fills in the fields defined by its content type" />
              </>
            ) : (
              'Update the fields of this entry.'
            )}
          </Text>
        </div>
        {entry && entry.status !== 'PUBLISHED' ? (
          <Button
            leftSection={<IconSend size={16} />}
            variant="light"
            loading={publishing}
            onClick={confirmPublish}
          >
            Publish
          </Button>
        ) : null}
      </Group>

      {loadError ? (
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          {loadError}
        </Alert>
      ) : entry && contentType ? (
        <EntryForm
          contentType={contentType}
          initial={{ title: entry.title, values: entry.values }}
          submitLabel="Save changes"
          busyLabel="Saving…"
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
