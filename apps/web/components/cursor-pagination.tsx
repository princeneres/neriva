'use client';

import { ActionIcon, Button, Group, Select, Text, Tooltip } from '@mantine/core';
import {
  IconArrowLeft,
  IconArrowRight,
  IconPlayerSkipBack,
  IconPlayerSkipForward,
} from '@tabler/icons-react';

export function CursorPagination({
  page,
  hasPrevious,
  hasNext,
  loading,
  limit,
  onPrevious,
  onNext,
  onFirst,
  onLast,
  onLimitChange,
}: {
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
  loading: boolean;
  limit: number;
  onPrevious: () => void;
  onNext: () => void;
  onFirst: () => void;
  onLast: () => void;
  onLimitChange: (limit: number) => void;
}) {
  return (
    <Group justify="space-between" gap="sm" mt="md" wrap="wrap">
      <Select
        size="xs"
        w={132}
        aria-label="Items per page"
        data={['12', '20', '24', '48', '96'].map((value) => ({
          value,
          label: `${value} per page`,
        }))}
        value={String(limit)}
        allowDeselect={false}
        onChange={(value) => value !== null && onLimitChange(Number(value))}
      />
      <Group gap={6} wrap="nowrap">
        <Tooltip label="First page">
          <ActionIcon
            size="sm"
            variant="default"
            disabled={!hasPrevious || loading}
            onClick={onFirst}
            aria-label="First page"
          >
            <IconPlayerSkipBack size={15} />
          </ActionIcon>
        </Tooltip>
        <Button
          size="xs"
          variant="default"
          leftSection={<IconArrowLeft size={14} />}
          disabled={!hasPrevious || loading}
          onClick={onPrevious}
        >
          Previous
        </Button>
        <Text size="xs" c="dimmed" miw={58} ta="center">
          Page {page}
        </Text>
        <Button
          size="xs"
          variant="default"
          rightSection={<IconArrowRight size={14} />}
          loading={loading}
          disabled={!hasNext || loading}
          onClick={onNext}
        >
          Next
        </Button>
        <Tooltip label="Last page">
          <ActionIcon
            size="sm"
            variant="default"
            disabled={!hasNext || loading}
            onClick={onLast}
            aria-label="Last page"
          >
            <IconPlayerSkipForward size={15} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  );
}
