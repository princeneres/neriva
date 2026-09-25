'use client';

import { Alert, Card, Code, Group, Skeleton, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { HelpTip } from '../../../../components/help-tip';
import { ApiError, api } from '../../../../lib/api';
import { DefinitionForm, type DefinitionFormValues } from '../definition-form';
import type { ObjectDefinition } from '../types';

export default function EditObjectDefinitionPage() {
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

  async function onSubmit(values: DefinitionFormValues) {
    const description = values.description.trim();
    await api.patch<{ data: ObjectDefinition }>(`/object-definitions/${id}`, {
      name: values.name,
      pluralName: values.pluralName,
      description: description === '' ? null : description,
      publicAccess: values.publicAccess,
      fields: values.fields,
    });
    notifications.show({
      color: 'green',
      title: 'Object updated',
      message: `"${values.name}" was saved.`,
    });
    router.push('/admin/objects');
  }

  return (
    <>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={1} fz="h2">
            Edit object
          </Title>
          <Text c="slate.5">
            Change the table name or its columns. Existing records keep their data.
          </Text>
        </div>
      </Group>

      {loadError ? (
        <Alert color="red" title="Could not load" maw={760}>
          {loadError}
        </Alert>
      ) : null}

      {!definition && !loadError ? (
        <Card padding="xl" maw={760}>
          <Stack gap="md">
            <Skeleton height={36} />
            <Skeleton height={36} />
            <Skeleton height={72} />
          </Stack>
        </Card>
      ) : null}

      {definition ? (
        <Stack maw={760} gap="md">
          <Card padding="md" bg="slate.0">
            <Group gap="xl">
              <div>
                <Text size="xs" c="slate.5" fw={600} tt="uppercase">
                  ID
                </Text>
                <Code>{definition.id}</Code>
              </div>
              <div>
                <Group gap={2}>
                  <Text size="xs" c="slate.5" fw={600} tt="uppercase">
                    Reference code
                  </Text>
                  <HelpTip label="A stable code integrations can use to find this object, even across environments" />
                </Group>
                <Code>{definition.externalReferenceCode}</Code>
              </div>
            </Group>
          </Card>
          <Card padding="xl">
            <DefinitionForm
              initial={{
                name: definition.name,
                pluralName: definition.pluralName,
                description: definition.description ?? '',
                publicAccess: definition.publicAccess,
                fields: definition.fields,
              }}
              submitLabel="Save changes"
              onSubmit={onSubmit}
            />
          </Card>
        </Stack>
      ) : null}
    </>
  );
}
