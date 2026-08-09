'use client';

import { Button, Card, Code, Group, Stack, Text, Title } from '@mantine/core';
import type { components } from '@neriva/contracts';
import Link from 'next/link';
import { HelpTip } from '../../../components/help-tip';

export type SystemSetting = components['schemas']['SystemSettingDto'];

export const KEY_PATTERN = /^[a-z][a-z0-9.-]*$/;

export const KEY_HINT = 'Lowercase letters, digits, dots and dashes; must start with a letter.';

export const VALUE_DESCRIPTION =
  'Any JSON value: text in quotes, numbers and true/false as-is. Plain text that is not valid JSON is saved as text.';

// UX decision: the value input accepts any JSON text. If the input is not
// valid JSON (for example a bare hostname like smtp.example.com), it is sent
// as a JSON string instead of rejecting the form. Users can still force a
// string by quoting it ("8025" stays the number 8025, "\"8025\"" is a string).
export function parseValueInput(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function previewValue(value: unknown, max = 80): string {
  const text = JSON.stringify(value) ?? '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// Maps RFC 7807 `errors` messages to the form field they name (messages
// produced by the API start with the property name, e.g. "key must match ...").
export function splitFieldErrors(errors: string[] | undefined): {
  key: string | null;
  value: string | null;
  other: string[];
} {
  const result: { key: string | null; value: string | null; other: string[] } = {
    key: null,
    value: null,
    other: [],
  };
  for (const message of errors ?? []) {
    const firstWord = message.trim().split(/\s+/)[0]?.toLowerCase();
    if (firstWord === 'key') {
      result.key ??= message;
    } else if (firstWord === 'value') {
      result.value ??= message;
    } else {
      result.other.push(message);
    }
  }
  return result;
}

const COMMON_SETTINGS = [
  {
    key: 'smtp.host',
    help: 'The address of the mail server Neriva uses to send email, for example smtp.example.com.',
  },
  {
    key: 'smtp.port',
    help: 'The port of the mail server. Most providers use 587 or 465.',
  },
  {
    key: 'smtp.user',
    help: 'The username Neriva signs in to the mail server with.',
  },
  {
    key: 'smtp.password',
    help: 'The password for the mail server account. Stored as a setting, so keep read access restricted.',
  },
  {
    key: 'site.name',
    help: 'The public name of your site, shown in page titles and outgoing email.',
  },
  {
    key: 'site.description',
    help: 'A short sentence describing your site, used in metadata such as search previews.',
  },
];

export function CommonSettingsCard() {
  return (
    <Card padding="lg" mt="lg" maw={640}>
      <Group gap={6} mb={2}>
        <Title order={3} fz="h4">
          Common settings
        </Title>
        <HelpTip label="These keys are conventions Neriva looks for. They are documented suggestions, not enforced by the API." />
      </Group>
      <Text size="sm" c="slate.5" mb="md">
        Frequently used keys. Click Set to create one with the key already filled in.
      </Text>
      <Stack gap="xs">
        {COMMON_SETTINGS.map((item) => (
          <Group key={item.key} justify="space-between" wrap="nowrap">
            <Group gap={2} wrap="nowrap">
              <Code>{item.key}</Code>
              <HelpTip label={item.help} />
            </Group>
            <Button
              component={Link}
              href={`/admin/settings/new?key=${encodeURIComponent(item.key)}`}
              size="compact-xs"
              variant="light"
            >
              Set
            </Button>
          </Group>
        ))}
      </Stack>
    </Card>
  );
}
