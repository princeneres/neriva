'use client';

import { Box, Code, ColorSwatch, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { isColorToken, type TokenRow } from './token-rows';

// Live preview: color tokens render as chips, everything else as a
// name/value list. Updates as the user types in the editor.
export function TokenPreview({ rows }: { rows: TokenRow[] }) {
  const named = rows.filter((row) => row.name.trim() !== '');
  const colorRows = named.filter((row) => isColorToken(row.name));
  const otherRows = named.filter((row) => !isColorToken(row.name));

  if (named.length === 0) {
    return (
      <Text size="sm" c="slate.5">
        Nothing to preview yet. Color tokens will show up here as chips as soon as you add them.
      </Text>
    );
  }

  return (
    <Stack gap="lg">
      {colorRows.length > 0 ? (
        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
          {colorRows.map((row) => (
            <Box key={row.id}>
              <ColorSwatch
                color={row.value || 'transparent'}
                radius="md"
                size={44}
                style={{ width: '100%', border: '1px solid var(--mantine-color-slate-2)' }}
              />
              <Text size="xs" ff="var(--font-mono)" mt={4} style={{ wordBreak: 'break-all' }}>
                {row.name}
              </Text>
              <Text size="xs" c="slate.5" style={{ wordBreak: 'break-all' }}>
                {row.value}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
      ) : null}
      {otherRows.length > 0 ? (
        <Stack gap={6}>
          {otherRows.map((row) => (
            <Group key={row.id} justify="space-between" gap="md" wrap="nowrap">
              <Code>{row.name}</Code>
              <Text size="sm" c="slate.6" ta="right" style={{ wordBreak: 'break-all' }}>
                {row.value}
              </Text>
            </Group>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}
