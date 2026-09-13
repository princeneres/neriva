'use client';

import {
  ActionIcon,
  Alert,
  Anchor,
  Box,
  Button,
  ColorInput,
  Divider,
  Group,
  Menu,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconAlertCircle,
  IconBorderRadius,
  IconPalette,
  IconPlus,
  IconRuler2,
  IconTag,
  IconTrash,
  IconTypography,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { HelpTip } from '../../../components/help-tip';
import { ApiError } from '../../../lib/api';
import {
  TOKEN_GROUPS,
  TOKEN_NAME_HINT,
  TOKEN_NAME_PATTERN,
  isColorToken,
  rowsToTokens,
  tokenGroupKey,
  tokensToRows,
  type TokenRow,
} from './token-rows';

export interface StyleBookDraft {
  name: string;
  tokens: Record<string, string>;
}

interface FormValues {
  name: string;
  rows: TokenRow[];
}

const COLOR_SWATCHES = [
  '#cc3d47',
  '#1a1917',
  '#403d37',
  '#7c7870',
  '#d4d0c8',
  '#faf9f7',
  '#ffffff',
  '#2f6fed',
  '#12b886',
  '#f59f00',
  '#7048e8',
  '#e64980',
];

const ADD_TOKEN_OPTIONS = [
  { label: 'Color', seed: 'color-', icon: IconPalette },
  { label: 'Spacing', seed: 'space-', icon: IconRuler2 },
  { label: 'Typography', seed: 'font-', icon: IconTypography },
  { label: 'Radius', seed: 'radius-', icon: IconBorderRadius },
];

export function StyleBookForm({
  initialName = '',
  initialTokens = {},
  submitLabel,
  onSubmit,
  onRowsChange,
}: {
  initialName?: string;
  initialTokens?: Record<string, string>;
  submitLabel: string;
  onSubmit: (draft: StyleBookDraft) => Promise<void>;
  onRowsChange?: (rows: TokenRow[]) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const nextId = useRef(Object.keys(initialTokens).length + 1);

  const form = useForm<FormValues>({
    initialValues: {
      name: initialName,
      rows: tokensToRows(initialTokens),
    },
    validate: {
      name: (value) => (value.trim() === '' ? 'Give this style book a name.' : null),
      rows: {
        name: (value, values) => {
          const trimmed = value.trim();
          if (!TOKEN_NAME_PATTERN.test(trimmed)) {
            return TOKEN_NAME_HINT;
          }
          const occurrences = values.rows.filter((row) => row.name.trim() === trimmed).length;
          return occurrences > 1 ? `The name "${trimmed}" is used more than once.` : null;
        },
        value: (value) => (value.trim() === '' ? 'Every token needs a value.' : null),
      },
    },
  });

  const rows = form.values.rows;

  useEffect(() => {
    onRowsChange?.(rows);
  }, [rows, onRowsChange]);

  function addRow(seed: string) {
    const id = nextId.current;
    nextId.current += 1;
    form.insertListItem('rows', { id, name: seed, value: '' });
  }

  const handleSubmit = form.onSubmit(async (values) => {
    setFormError(null);
    setSubmitting(true);
    try {
      await onSubmit({ name: values.name.trim(), tokens: rowsToTokens(values.rows) });
    } catch (error) {
      if (error instanceof ApiError) {
        const messages = error.problem.errors ?? [];
        const nameMessages = messages.filter((message) => message.toLowerCase().startsWith('name'));
        if (nameMessages.length > 0) {
          form.setFieldError('name', nameMessages.join(' '));
        }
        setFormError(messages.length > 0 ? messages.join(' ') : error.message);
      } else {
        setFormError('Unexpected error. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  });

  const groups = TOKEN_GROUPS.map((group) => ({
    ...group,
    rows: rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => tokenGroupKey(row.name) === group.key),
  })).filter((group) => group.rows.length > 0);

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg">
        {formError ? (
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            {formError}
          </Alert>
        ) : null}

        <TextInput
          label="Name"
          placeholder="Default theme"
          disabled={submitting}
          {...form.getInputProps('name')}
        />

        <Box>
          <Group gap={2} mb={4}>
            <Text component="label" size="sm" fw={500}>
              Tokens
            </Text>
            <HelpTip label="Design decisions with a name: blocks reference the name, you change the value in one place." />
          </Group>
          <Text size="xs" c="slate.5" mb="sm">
            Names use lowercase letters, digits and dashes, and start with a letter, e.g.{' '}
            <Text span ff="var(--font-mono)" inherit>
              color-primary
            </Text>{' '}
            or{' '}
            <Text span ff="var(--font-mono)" inherit>
              space-4
            </Text>
            . Tokens named{' '}
            <Text span ff="var(--font-mono)" inherit>
              color...
            </Text>{' '}
            get a color picker.
          </Text>

          <Stack gap="md">
            {groups.map((group, groupIndex) => (
              <Box key={group.key}>
                {groupIndex > 0 ? <Divider mb="md" color="slate.1" /> : null}
                <Text size="xs" fw={700} tt="uppercase" c="slate.5" lts="0.06em" mb={6}>
                  {group.label}
                </Text>
                <Stack gap="xs">
                  {group.rows.map(({ row, index }) => (
                    <Group key={row.id} gap="xs" align="flex-start" wrap="nowrap">
                      <TextInput
                        aria-label="Token name"
                        placeholder="color-primary"
                        disabled={submitting}
                        style={{ flex: 1, minWidth: 0 }}
                        styles={{ input: { fontFamily: 'var(--font-mono)' } }}
                        {...form.getInputProps(`rows.${index}.name`)}
                      />
                      {isColorToken(row.name) ? (
                        <ColorInput
                          aria-label="Token value"
                          placeholder="#cc3d47"
                          disabled={submitting}
                          withEyeDropper
                          fixOnBlur={false}
                          swatches={COLOR_SWATCHES}
                          swatchesPerRow={6}
                          style={{ flex: 1, minWidth: 0 }}
                          {...form.getInputProps(`rows.${index}.value`)}
                        />
                      ) : (
                        <TextInput
                          aria-label="Token value"
                          placeholder="1rem"
                          disabled={submitting}
                          style={{ flex: 1, minWidth: 0 }}
                          {...form.getInputProps(`rows.${index}.value`)}
                        />
                      )}
                      <Tooltip label="Remove token">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          mt={4}
                          disabled={submitting}
                          aria-label="Remove token"
                          onClick={() => form.removeListItem('rows', index)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  ))}
                </Stack>
              </Box>
            ))}

            {rows.length === 0 ? (
              <Text size="sm" c="slate.5">
                No tokens yet. Start with a color: name it color-primary and pick a value.
              </Text>
            ) : null}

            <Box>
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <Button
                    variant="light"
                    leftSection={<IconPlus size={16} />}
                    disabled={submitting}
                  >
                    Add token
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  {ADD_TOKEN_OPTIONS.map((option) => (
                    <Menu.Item
                      key={option.seed}
                      leftSection={<option.icon size={15} />}
                      onClick={() => addRow(option.seed)}
                    >
                      {option.label}
                    </Menu.Item>
                  ))}
                  <Menu.Divider />
                  <Menu.Item leftSection={<IconTag size={15} />} onClick={() => addRow('')}>
                    Custom token
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Box>
          </Stack>
        </Box>

        <Group>
          <Button type="submit" loading={submitting}>
            {submitLabel}
          </Button>
          <Anchor component={Link} href="/admin/style-book" size="sm" c="slate.5">
            Cancel
          </Anchor>
        </Group>
      </Stack>
    </form>
  );
}
