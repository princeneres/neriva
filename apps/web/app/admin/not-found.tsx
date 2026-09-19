'use client';

import { Button, Card, Code, Group, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconArrowLeft, IconMapSearch } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Rendered inside app/admin/layout.tsx, so the sidebar stays put and the user
// can keep working instead of being dropped on a dead end. Covers both the
// routes that call notFound() on purpose (Trash, until spec 15 ships) and any
// admin address that no longer exists.
export default function AdminNotFound() {
  const pathname = usePathname();

  return (
    <>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={1} fz="h2">
            Page not found
          </Title>
          <Text c="slate.5">This part of the admin does not exist, or is not available yet.</Text>
        </div>
      </Group>

      <Card padding={0}>
        <Stack align="center" gap="sm" py={64} px="md">
          <ThemeIcon size={44} radius="xl" variant="light">
            <IconMapSearch size={22} stroke={1.7} />
          </ThemeIcon>
          <Text fw={600}>Nothing lives at this address</Text>
          <Text size="sm" c="slate.5" ta="center" maw={420}>
            The screen you tried to open was moved, renamed, or was never part of this install.
            Everything you can manage is listed in the menu on the left.
          </Text>
          {pathname ? <Code>{pathname}</Code> : null}
          <Group gap="xs" mt="xs">
            <Button component={Link} href="/admin/sites" leftSection={<IconArrowLeft size={16} />}>
              Back to Sites
            </Button>
            <Button component={Link} href="/" variant="default">
              Open the site
            </Button>
          </Group>
        </Stack>
      </Card>
    </>
  );
}
