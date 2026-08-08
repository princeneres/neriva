'use client';

import { Alert, Card, Code, Group, Skeleton, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { HelpTip } from '../../../../../components/help-tip';
import { ApiError, api } from '../../../../../lib/api';
import { RecordForm, initialRecordValues } from '../../record-form';
import type { ObjectDefinition, ObjectRecord } from '../../types';

export default function EditObjectRecordPage() {
  const router = useRouter();
  const { recordId } = useParams<{ recordId: string }>();
  const [record, setRecord] = useState<ObjectRecord | null>(null);
  const [definition, setDefinition] = useState<ObjectDefinition | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: ObjectRecord }>(`/object-records/${recordId}`)
      .then(async ({ data }) => {
        setRecord(data);
        const definitionResponse = await api.get<{ data: ObjectDefinition }>(
          `/object-definitions/${data.objectDefinitionId}`,
        );
        setDefinition(definitionResponse.data);
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load the record');
      });
  }, [recordId]);

  async function onSubmit(data: Record<string, unknown>) {
    await api.patch<{ data: ObjectRecord }>(`/object-records/${recordId}`, { data });
    notifications.show({
      color: 'green',
      title: 'Record updated',
      message: 'Your changes were saved.',
    });
    router.push(`/admin/objects/${definition?.id}/records`);
  }

  return (
    <>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={1} fz="h2">
            {definition ? `Edit ${definition.name}` : 'Edit record'}
          </Title>
          <Text c="slate.5">Update this row and save your changes.</Text>
        </div>
      </Group>

      {loadError ? (
        <Alert color="red" title="Could not load" maw={640}>
          {loadError}
        </Alert>
      ) : null}

      {!(record && definition) && !loadError ? (
        <Card padding="xl" maw={640}>
          <Stack gap="md">
            <Skeleton height={36} />
            <Skeleton height={36} />
            <Skeleton height={36} />
          </Stack>
        </Card>
      ) : null}

      {record && definition ? (
        <Stack maw={640} gap="md">
          <Card padding="md" bg="slate.0">
            <Group gap="xl">
              <div>
                <Text size="xs" c="slate.5" fw={600} tt="uppercase">
                  ID
                </Text>
                <Code>{record.id}</Code>
              </div>
              <div>
                <Group gap={2}>
                  <Text size="xs" c="slate.5" fw={600} tt="uppercase">
                    Reference code
                  </Text>
                  <HelpTip label="A stable code integrations can use to find this record, even across environments" />
                </Group>
                <Code>{record.externalReferenceCode}</Code>
              </div>
            </Group>
          </Card>
          <Card padding="xl">
            <RecordForm
              definition={definition}
              initial={initialRecordValues(definition, record.data)}
              submitLabel="Save changes"
              onSubmit={onSubmit}
            />
          </Card>
        </Stack>
      ) : null}
    </>
  );
}
