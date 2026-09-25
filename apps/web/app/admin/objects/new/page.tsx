'use client';

import { Card, Group, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useRouter } from 'next/navigation';
import { HelpTip } from '../../../../components/help-tip';
import { api } from '../../../../lib/api';
import { DefinitionForm, type DefinitionFormValues } from '../definition-form';
import { OBJECTS_HELP, type ObjectDefinition } from '../types';

export default function NewObjectDefinitionPage() {
  const router = useRouter();

  async function onSubmit(values: DefinitionFormValues) {
    const description = values.description.trim();
    await api.post<{ data: ObjectDefinition }>('/object-definitions', {
      name: values.name,
      pluralName: values.pluralName,
      ...(description ? { description } : {}),
      publicAccess: values.publicAccess,
      fields: values.fields,
    });
    notifications.show({
      color: 'green',
      title: 'Object created',
      message: `"${values.name}" is ready. You can start adding records.`,
    });
    router.push('/admin/objects');
  }

  return (
    <>
      <Group justify="space-between" mb="lg">
        <div>
          <Group gap={6}>
            <Title order={1} fz="h2">
              New object
            </Title>
            <HelpTip label={OBJECTS_HELP} />
          </Group>
          <Text c="slate.5">Name your table and describe its columns.</Text>
        </div>
      </Group>

      <Card padding="xl" maw={760}>
        <DefinitionForm submitLabel="Create object" onSubmit={onSubmit} />
      </Card>
    </>
  );
}
