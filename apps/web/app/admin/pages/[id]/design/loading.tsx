import { Center, Loader, Stack, Text } from '@mantine/core';

// Instant feedback while the studio chunk compiles/loads.
export default function DesignLoading() {
  return (
    <Center mih="60vh">
      <Stack align="center" gap="xs">
        <Loader color="neriva" />
        <Text size="sm" c="dimmed">
          Opening the page editor…
        </Text>
      </Stack>
    </Center>
  );
}
