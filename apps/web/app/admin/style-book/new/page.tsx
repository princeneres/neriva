'use client';

import type { components } from '@neriva/contracts';
import { Card, Grid, Group, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { HelpTip } from '../../../../components/help-tip';
import { api } from '../../../../lib/api';
import { StyleBookForm, type StyleBookDraft } from '../style-book-form';
import { TokenPreview } from '../token-preview';
import type { TokenRow } from '../token-rows';

type StyleBook = components['schemas']['StyleBookDto'];

export default function NewStyleBookPage() {
  const router = useRouter();
  const [previewRows, setPreviewRows] = useState<TokenRow[]>([]);

  async function onSubmit(draft: StyleBookDraft) {
    const { data } = await api.post<{ data: StyleBook }>('/style-books', draft);
    notifications.show({ color: 'green', message: `"${data.name}" created` });
    router.push(`/admin/style-book/${data.id}`);
  }

  return (
    <>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={1} fz="h2">
            New style book
          </Title>
          <Text c="slate.5">
            Name it, then add tokens: the named colors, spacing and typography blocks will reuse.
          </Text>
        </div>
      </Group>

      <Grid gutter="lg" align="stretch">
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Card>
            <StyleBookForm submitLabel="Create" onSubmit={onSubmit} onRowsChange={setPreviewRows} />
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Card>
            <Group gap={2} mb="md">
              <Text fw={600}>Preview</Text>
              <HelpTip label="Updates live as you type: color tokens show as chips, other tokens as a list." />
            </Group>
            <TokenPreview rows={previewRows} />
          </Card>
        </Grid.Col>
      </Grid>
    </>
  );
}
