'use client';

import { Alert, Card, Group, Skeleton, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { HelpTip } from '../../../../../../components/help-tip';
import { ApiError, api } from '../../../../../../lib/api';
import { RecordForm } from '../../../record-form';
import type { ObjectDefinition, ObjectRecord } from '../../../types';

export default function NewObjectRecordPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [definition, setDefinition] = useState<ObjectDefinition | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: ObjectDefinition }>(`/object-definitions/${id}`)
      .then(({ data }) => setDefinition(data))
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load the object');
      });
  }, [id]);

  async function onSubmit(data: Record<string, unknown>) {
    await api.post<{ data: ObjectRecord }>(`/object-definitions/${id}/records`, { data });
    notifications.show({
      color: 'green',
      title: 'Record created',
      message: definition ? `A new ${definition.name} record was added.` : 'The record was added.',
    });
    router.push(`/admin/objects/${id}/records`);
  }

  return (
    <>
      <Group justify="space-between" mb="lg">
        <div>
          <Group gap={6}>
            <Title order={1} fz="h2">
              {definition ? `New ${definition.name}` : 'New record'}
            </Title>
            <HelpTip label="A record is one row of this table: fill in the fields the object defines" />
          </Group>
          <Text c="slate.5">Fill in the fields and save to add a row to this table.</Text>
        </div>
      </Group>

      {loadError ? (
        <Alert color="red" title="Could not load" maw={640}>
          {loadError}
        </Alert>
      ) : null}

      {!definition && !loadError ? (
        <Card padding="xl" maw={640}>
          <Stack gap="md">
            <Skeleton height={36} />
            <Skeleton height={36} />
            <Skeleton height={36} />
          </Stack>
        </Card>
      ) : null}

      {definition ? (
        <Card padding="xl" maw={640}>
          <RecordForm definition={definition} submitLabel="Create record" onSubmit={onSubmit} />
        </Card>
      ) : null}
    </>
  );
}
