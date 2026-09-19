'use client';

import { Alert, Button, Card, Code, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconAlertTriangle, IconArrowLeft, IconRefresh } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { ApiError } from '../../lib/api';

// Rendered inside app/admin/layout.tsx: the sidebar survives, so a broken
// screen never traps the user. What the visitor is allowed to read is the
// same thing the admin already shows in a red notification, the problem+json
// detail of an ApiError. Anything else is an internal failure: it goes to the
// console, and the user only gets Next's digest to quote.
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[neriva] admin error', error);
  }, [error]);

  const apiDetail = error instanceof ApiError ? error.message : null;

  return (
    <>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={1} fz="h2">
            Something went wrong
          </Title>
          <Text c="slate.5">
            This screen stopped before it could finish. Nothing you were editing was sent.
          </Text>
        </div>
      </Group>

      <Card padding={0}>
        <Stack align="center" gap="sm" py={64} px="md">
          <ThemeIcon size={44} radius="xl" variant="light" color="red">
            <IconAlertTriangle size={22} stroke={1.7} />
          </ThemeIcon>
          <Text fw={600}>We could not load this screen</Text>
          <Text size="sm" c="slate.5" ta="center" maw={420}>
            Try again first. If it keeps failing, whoever administers this install can look the
            failure up from the reference below.
          </Text>

          {apiDetail ? (
            <Alert color="red" variant="light" maw={460} w="100%">
              {apiDetail}
            </Alert>
          ) : null}

          {error.digest ? (
            <Text size="xs" c="slate.5">
              Reference <Code>{error.digest}</Code>
            </Text>
          ) : null}

          <Group gap="xs" mt="xs">
            <Button onClick={reset} leftSection={<IconRefresh size={16} />}>
              Try again
            </Button>
            <Button
              component={Link}
              href="/admin/sites"
              variant="default"
              leftSection={<IconArrowLeft size={16} />}
            >
              Back to Sites
            </Button>
          </Group>
        </Stack>
      </Card>
    </>
  );
}
