'use client';

import {
  Alert,
  Button,
  Group,
  NumberInput,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle } from '@tabler/icons-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { HelpTip } from '../../../../components/help-tip';
import { ApiError } from '../../../../lib/api';
import { FIELD_TYPE_META, type ContentField, type ContentType } from '../types';

export interface EntryFormValues {
  title: string;
  values: Record<string, unknown>;
}

// Per-field UI state: strings for text-like inputs, number | '' for
// NumberInput, boolean for switches.
type FieldState = Record<string, string | number | boolean>;

interface FormState {
  title: string;
  values: FieldState;
}

function toFieldState(fields: ContentField[], values: Record<string, unknown>): FieldState {
  const state: FieldState = {};
  for (const field of fields) {
    const value = values[field.key];
    switch (field.type) {
      case 'boolean':
        state[field.key] = value === true;
        break;
      case 'number':
        state[field.key] = typeof value === 'number' ? value : '';
        break;
      case 'date':
        // ISO 8601 string; keep only the date part for <input type="date">.
        state[field.key] = typeof value === 'string' ? value.slice(0, 10) : '';
        break;
      default:
        state[field.key] = typeof value === 'string' ? value : '';
    }
  }
  return state;
}

function toApiValues(fields: ContentField[], state: FieldState): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = state[field.key];
    switch (field.type) {
      case 'boolean':
        values[field.key] = raw === true;
        break;
      case 'number':
        if (typeof raw === 'number') {
          values[field.key] = raw;
        } else if (typeof raw === 'string' && raw.trim() !== '') {
          values[field.key] = Number(raw);
        }
        break;
      case 'date': {
        const text = typeof raw === 'string' ? raw : '';
        if (text !== '') {
          values[field.key] = new Date(text).toISOString();
        }
        break;
      }
      default: {
        const text = typeof raw === 'string' ? raw : '';
        if (text !== '') {
          values[field.key] = text;
        }
      }
    }
  }
  return values;
}

function isEmptyValue(field: ContentField, value: string | number | boolean | undefined): boolean {
  if (field.type === 'number') {
    return typeof value !== 'number';
  }
  return typeof value !== 'string' || value.trim() === '';
}

function fieldHelp(field: ContentField): string {
  const meta = FIELD_TYPE_META[field.type];
  const required = field.required ? ' This field is required.' : '';
  return `${field.label}: ${meta.description.toLowerCase().replace(/\.$/, '')}.${required}`;
}

function fieldLabel(field: ContentField): ReactNode {
  return (
    <span>
      {field.label}
      <HelpTip label={fieldHelp(field)} />
    </span>
  );
}

export function EntryForm({
  contentType,
  initial,
  submitLabel,
  busyLabel,
  onSubmit,
}: {
  contentType: ContentType;
  initial?: EntryFormValues;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (values: EntryFormValues) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const form = useForm<FormState>({
    initialValues: {
      title: initial?.title ?? '',
      values: toFieldState(contentType.fields, initial?.values ?? {}),
    },
    validate: {
      title: (value) => (value.trim() === '' ? 'Title is required' : null),
      values: Object.fromEntries(
        contentType.fields
          .filter((field) => field.required && field.type !== 'boolean')
          .map((field) => [
            field.key,
            (value: string | number | boolean | undefined) =>
              isEmptyValue(field, value) ? `${field.label} is required` : null,
          ]),
      ),
    },
  });

  const handleSubmit = form.onSubmit(async (state) => {
    setError(null);
    setErrorDetails([]);
    setBusy(true);
    try {
      await onSubmit({
        title: state.title,
        values: toApiValues(contentType.fields, state.values),
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setErrorDetails(err.problem.errors ?? []);
      } else {
        setError('Saving the entry failed');
      }
      setBusy(false);
    }
  });

  function renderField(field: ContentField): ReactNode {
    switch (field.type) {
      case 'richtext':
        return (
          <Textarea
            key={field.key}
            label={fieldLabel(field)}
            description="Rich text is stored as plain text in v1"
            withAsterisk={field.required}
            autosize
            minRows={4}
            {...form.getInputProps(`values.${field.key}`)}
          />
        );
      case 'number':
        return (
          <NumberInput
            key={field.key}
            label={fieldLabel(field)}
            withAsterisk={field.required}
            step={1}
            {...form.getInputProps(`values.${field.key}`)}
          />
        );
      case 'boolean':
        return (
          <Switch
            key={field.key}
            label={fieldLabel(field)}
            {...form.getInputProps(`values.${field.key}`, { type: 'checkbox' })}
          />
        );
      case 'date':
        return (
          <TextInput
            key={field.key}
            type="date"
            label={fieldLabel(field)}
            withAsterisk={field.required}
            {...form.getInputProps(`values.${field.key}`)}
          />
        );
      default:
        return (
          <TextInput
            key={field.key}
            label={fieldLabel(field)}
            withAsterisk={field.required}
            {...form.getInputProps(`values.${field.key}`)}
          />
        );
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md" maw={640}>
        {error ? (
          <Alert color="red" icon={<IconAlertCircle size={16} />} title={error}>
            {errorDetails.length > 0 ? (
              <Stack gap={2}>
                {errorDetails.map((detail) => (
                  <Text key={detail} size="sm">
                    {detail}
                  </Text>
                ))}
              </Stack>
            ) : null}
          </Alert>
        ) : null}

        <TextInput
          label={
            <span>
              Title
              <HelpTip label="The name of this entry in lists; not one of the type fields" />
            </span>
          }
          withAsterisk
          maxLength={255}
          {...form.getInputProps('title')}
        />

        {contentType.fields.map((field) => renderField(field))}

        <Group gap="sm">
          <Button type="submit" loading={busy}>
            {busy ? busyLabel : submitLabel}
          </Button>
          <Button component={Link} href="/admin/content/entries" variant="subtle" color="slate">
            Cancel
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
