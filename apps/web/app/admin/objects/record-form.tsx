'use client';

import { Alert, Button, Group, NumberInput, Select, Stack, Switch, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import Link from 'next/link';
import { useState } from 'react';
import { ApiError } from '../../../lib/api';
import type { ObjectDefinition, ObjectField } from './types';

// Input state per field key: booleans are booleans (Switch), numbers are
// number | '' (NumberInput), everything else is a string.
export type RecordFormValues = Record<string, string | number | boolean>;

export function initialRecordValues(
  definition: ObjectDefinition,
  data: Record<string, unknown> = {},
): RecordFormValues {
  const values: RecordFormValues = {};
  for (const field of definition.fields) {
    const value = data[field.key];
    if (field.type === 'boolean') {
      values[field.key] = value === true;
    } else if (field.type === 'number') {
      values[field.key] = typeof value === 'number' ? value : '';
    } else if (typeof value === 'string') {
      values[field.key] = value;
    } else {
      values[field.key] = '';
    }
  }
  return values;
}

// Builds the record `data` payload. Empty optional inputs are omitted so the
// API does not receive mistyped values; booleans are always sent.
function buildData(fields: ObjectField[], values: RecordFormValues): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field.key];
    if (field.type === 'boolean') {
      data[field.key] = value === true;
      continue;
    }
    if (field.type === 'number') {
      if (typeof value === 'number') {
        data[field.key] = value;
      }
      continue;
    }
    const raw = typeof value === 'string' ? value.trim() : '';
    if (raw !== '') {
      data[field.key] = raw;
    }
  }
  return data;
}

// The API reports record validation problems as `Field "key" ...` details;
// map them back to the matching input when possible.
function detailFieldKey(detail: string, fields: ObjectField[]): string | null {
  const key = /^Field "([a-zA-Z0-9]+)"/.exec(detail)?.[1];
  if (key !== undefined && fields.some((field) => field.key === key)) {
    return key;
  }
  return null;
}

export function RecordForm({
  definition,
  initial,
  submitLabel,
  onSubmit,
}: {
  definition: ObjectDefinition;
  initial?: RecordFormValues;
  submitLabel: string;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const form = useForm<RecordFormValues>({
    initialValues: initial ?? initialRecordValues(definition),
    validate: (values) => {
      const errors: Record<string, string> = {};
      for (const field of definition.fields) {
        if (!field.required || field.type === 'boolean') {
          continue;
        }
        const value = values[field.key];
        const empty =
          field.type === 'number'
            ? typeof value !== 'number'
            : typeof value !== 'string' || value.trim() === '';
        if (empty) {
          errors[field.key] = 'This field is required';
        }
      }
      return errors;
    },
  });

  async function handleSubmit(values: RecordFormValues) {
    setFormError(null);
    setBusy(true);
    try {
      await onSubmit(buildData(definition.fields, values));
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldKey = err.problem.detail
          ? detailFieldKey(err.problem.detail, definition.fields)
          : null;
        if (fieldKey) {
          form.setFieldError(fieldKey, err.message);
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError('Saving the record failed. Please try again.');
      }
      setBusy(false);
    }
  }

  return (
    <form onSubmit={form.onSubmit((values) => void handleSubmit(values))}>
      <Stack gap="md">
        {formError ? (
          <Alert color="red" title="Could not save">
            {formError}
          </Alert>
        ) : null}

        {definition.fields.map((field) => {
          switch (field.type) {
            case 'boolean':
              return (
                <Switch
                  key={field.key}
                  label={field.label}
                  {...form.getInputProps(field.key, { type: 'checkbox' })}
                />
              );
            case 'number':
              return (
                <NumberInput
                  key={field.key}
                  label={field.label}
                  withAsterisk={field.required}
                  decimalScale={10}
                  {...form.getInputProps(field.key)}
                />
              );
            case 'picklist':
              return (
                <Select
                  key={field.key}
                  label={field.label}
                  withAsterisk={field.required}
                  placeholder="Pick one"
                  data={field.options ?? []}
                  clearable={!field.required}
                  {...form.getInputProps(field.key)}
                />
              );
            case 'date':
              return (
                <TextInput
                  key={field.key}
                  type="date"
                  label={field.label}
                  withAsterisk={field.required}
                  {...form.getInputProps(field.key)}
                />
              );
            default:
              return (
                <TextInput
                  key={field.key}
                  label={field.label}
                  withAsterisk={field.required}
                  {...form.getInputProps(field.key)}
                />
              );
          }
        })}

        <Group mt="sm">
          <Button type="submit" loading={busy}>
            {submitLabel}
          </Button>
          <Button
            component={Link}
            href={`/admin/objects/${definition.id}/records`}
            variant="subtle"
            color="gray"
          >
            Cancel
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
