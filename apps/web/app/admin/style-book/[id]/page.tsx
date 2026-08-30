'use client';

import type { components } from '@neriva/contracts';
import {
  Alert,
  Badge,
  Button,
  Card,
  Code,
  Grid,
  Group,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconCode } from '@tabler/icons-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { HelpTip } from '../../../../components/help-tip';
import { ApiError, api } from '../../../../lib/api';
import { apiUrl } from '../../../../lib/api-url';
import { getAccessToken } from '../../../../lib/auth-storage';
import { StyleBookForm, type StyleBookDraft } from '../style-book-form';
import { TokenPreview } from '../token-preview';
import { tokensToRows, type TokenRow } from '../token-rows';

type StyleBook = components['schemas']['StyleBookDto'];

const STATUS_COLORS: Record<StyleBook['status'], string> = {
  DRAFT: 'gray',
  PUBLISHED: 'green',
  ARCHIVED: 'dark',
};

export default function EditStyleBookPage() {
  const { id } = useParams<{ id: string }>();
  const [styleBook, setStyleBook] = useState<StyleBook | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<TokenRow[]>([]);
  const [css, setCss] = useState<string | null>(null);
  const [cssLoading, setCssLoading] = useState(false);

  useEffect(() => {
    api
      .get<{ data: StyleBook }>(`/style-books/${id}`)
      .then(({ data }) => {
        setStyleBook(data);
        setPreviewRows(tokensToRows(data.tokens));
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof ApiError ? error.message : 'Failed to load style book');
      });
  }, [id]);

  async function onSubmit(draft: StyleBookDraft) {
    const { data } = await api.patch<{ data: StyleBook }>(`/style-books/${id}`, draft);
    setStyleBook(data);
    setCss(null);
    notifications.show({ color: 'green', message: 'Style book saved' });
  }

  async function onViewCss() {
    if (css !== null) {
      setCss(null);
      return;
    }
    setCssLoading(true);
    try {
      // The /css endpoint returns text/css, so it bypasses api.get (JSON only).
      const token = getAccessToken();
      const response = await fetch(apiUrl(`/style-books/${id}/css`), {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      setCss(await response.text());
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : 'Failed to load CSS',
      });
    } finally {
      setCssLoading(false);
    }
  }

  if (loadError) {
    return (
      <>
        <Title order={1} fz="h2" mb="lg">
          Style book
        </Title>
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          {loadError}
        </Alert>
      </>
    );
  }

  if (!styleBook) {
    return (
      <>
        <Skeleton height={34} width={280} mb="lg" />
        <Grid gutter="lg">
          <Grid.Col span={{ base: 12, lg: 7 }}>
            <Card>
              <Stack gap="md">
                <Skeleton height={36} />
                <Skeleton height={36} />
                <Skeleton height={36} />
              </Stack>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 5 }}>
            <Card>
              <Skeleton height={120} />
            </Card>
          </Grid.Col>
        </Grid>
      </>
    );
  }

  return (
    <>
      <Group justify="space-between" mb="lg">
        <div>
          <Group gap="sm">
            <Title order={1} fz="h2">
              {styleBook.name}
            </Title>
            <Badge color={STATUS_COLORS[styleBook.status]}>{styleBook.status}</Badge>
          </Group>
          <Text c="slate.5">
            Version {styleBook.version}
            <HelpTip label="Goes up by one every time you publish, so you can tell which set of tokens is live. Publish from the Style Book list." />
          </Text>
        </div>
      </Group>

      <Grid gutter="lg" align="stretch">
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Card>
            <StyleBookForm
              initialName={styleBook.name}
              initialTokens={styleBook.tokens}
              submitLabel="Save"
              onSubmit={onSubmit}
              onRowsChange={setPreviewRows}
            />
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Stack gap="lg">
            <Card>
              <Group gap={2} mb="md">
                <Text fw={600}>Preview</Text>
                <HelpTip label="Updates live as you type: color tokens show as chips, other tokens as a list." />
              </Group>
              <TokenPreview rows={previewRows} />
            </Card>

            <Card>
              <Group justify="space-between" mb="md">
                <Group gap={2}>
                  <Text fw={600}>CSS output</Text>
                  <HelpTip label="Every token becomes a --nv- CSS variable. Sites load this stylesheet to apply the style book. Shows the last saved version." />
                </Group>
                <Button
                  variant="light"
                  size="xs"
                  leftSection={<IconCode size={14} />}
                  loading={cssLoading}
                  onClick={() => void onViewCss()}
                >
                  {css !== null ? 'Hide CSS' : 'View CSS'}
                </Button>
              </Group>
              {css !== null ? (
                <Code block>{css}</Code>
              ) : (
                <Text size="sm" c="slate.5">
                  See the stylesheet exactly as the rendering runtime consumes it.
                </Text>
              )}
            </Card>

            <Card bg="slate.0">
              <Text size="xs" fw={700} tt="uppercase" c="slate.5" lts="0.06em" mb="xs">
                Details
              </Text>
              <Stack gap={6}>
                <Group justify="space-between" gap="md" wrap="nowrap">
                  <Text size="sm" c="slate.5">
                    ID
                  </Text>
                  <Code>{styleBook.id}</Code>
                </Group>
                <Group justify="space-between" gap="md" wrap="nowrap">
                  <Text size="sm" c="slate.5">
                    Reference code
                    <HelpTip label="A stable code other systems can use to find this style book, even across environments." />
                  </Text>
                  <Code>{styleBook.externalReferenceCode}</Code>
                </Group>
                <Group justify="space-between" gap="md" wrap="nowrap">
                  <Text size="sm" c="slate.5">
                    Created
                  </Text>
                  <Text size="sm">{new Date(styleBook.createdAt).toLocaleString()}</Text>
                </Group>
                <Group justify="space-between" gap="md" wrap="nowrap">
                  <Text size="sm" c="slate.5">
                    Updated
                  </Text>
                  <Text size="sm">{new Date(styleBook.updatedAt).toLocaleString()}</Text>
                </Group>
              </Stack>
            </Card>
          </Stack>
        </Grid.Col>
      </Grid>
    </>
  );
}
