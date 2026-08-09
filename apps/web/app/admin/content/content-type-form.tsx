'use client';

import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle, IconPlus, IconTrash } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';
import { HelpTip } from '../../../components/help-tip';
import { ApiError } from '../../../lib/api';
import { FIELD_TYPE_META, FIELD_TYPE_OPTIONS, type ContentField } from './types';

export interface ContentTypeFormValues {
  name: string;
  description: string;
  fields: ContentField[];
}

const KEY_PATTERN = /^[a-z][a-zA-Z0-9]*$/;
const KEY_HINT = 'Start with a lowercase letter, then letters and digits only (e.g. headline)';

export function ContentTypeForm({
  initial,
  submitLabel,
  busyLabel,
  onSubmit,
}: {
  initial?: ContentTypeFormValues;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (values: ContentTypeFormValues) => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const form = useForm<ContentTypeFormValues>({
    initialValues: initial ?? { name: '', description: '', fields: [] },
    validate: {
      name: (value) => (value.trim() === '' ? 'Name is required' : null),
      fields: {
        key: (value, values) => {
          if (!KEY_PATTERN.test(value)) {
            return KEY_HINT;
          }
          if (values.fields.filter((field) => field.key === value).length > 1) {
            return `Duplicate key "${value}"`;
          }
          return null;
        },
        label: (value) => (value.trim() === '' ? 'Label is required' : null),
      },
    },
  });

  function addField() {
    form.insertListItem('fields', {
      key: '',
      label: '',
      type: 'text',
      required: false,
    } satisfies ContentField);
  }

  const handleSubmit = form.onSubmit(async (values) => {
    setError(null);
    setErrorDetails([]);
    setBusy(true);
    try {
      await onSubmit({
        name: values.name,
        description: values.description,
        fields: values.fields.map((field) => ({
          key: field.key,
          label: field.label,
          type: field.type,
          required: field.required,
        })),
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setErrorDetails(err.problem.errors ?? []);
      } else {
        setError('Saving the content type failed');
      }
      setBusy(false);
    }
  });

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md" maw={860}>
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
              Name
              <HelpTip label="What this kind of content is called, e.g. Article, FAQ, Testimonial" />
            </span>
          }
          placeholder="e.g. Article"
          withAsterisk
          maxLength={255}
          {...form.getInputProps('name')}
        />
        <Textarea
          label={
            <span>
              Description
              <HelpTip label="A short note that helps editors pick the right type" />
            </span>
          }
          placeholder="What is this type used for?"
          autosize
          minRows={2}
          {...form.getInputProps('description')}
        />

        <div>
          <Group gap={4} mb={4}>
            <Text component="label" size="sm" fw={500}>
              Fields
            </Text>
            <HelpTip label="The form editors fill in for every entry of this type. Each field has a technical key, a friendly label and a type." />
          </Group>
          <Stack gap="sm">
            {form.values.fields.length === 0 ? (
              <Card padding="lg" style={{ borderStyle: 'dashed' }}>
                <Text size="sm" c="slate.5" ta="center">
                  No fields yet. Add the first field to define what each entry of this type
                  contains.
                </Text>
              </Card>
            ) : (
              form.values.fields.map((field, index) => (
                <Card key={index} padding="sm">
                  <Group align="flex-start" wrap="nowrap" gap="sm">
                    <TextInput
                      flex={1}
                      aria-label="Field key"
                      label={
                        <span>
                          Key
                          <HelpTip label="Technical name used by the API, e.g. headline. Lowercase start, letters and digits only." />
                        </span>
                      }
                      placeholder="headline"
                      {...form.getInputProps(`fields.${index}.key`)}
                    />
                    <TextInput
                      flex={1}
                      aria-label="Field label"
                      label={
                        <span>
                          Label
                          <HelpTip label="The friendly name editors see, e.g. Headline" />
                        </span>
                      }
                      placeholder="Headline"
                      {...form.getInputProps(`fields.${index}.label`)}
                    />
                    <Select
                      w={170}
                      aria-label="Field type"
                      label={
                        <span>
                          Type
                          <HelpTip label="What kind of value this field holds" />
                        </span>
                      }
                      data={FIELD_TYPE_OPTIONS}
                      allowDeselect={false}
                      renderOption={({ option }) => (
                        <div>
                          <Text size="sm">{option.label}</Text>
                          <Text size="xs" c="slate.5">
                            {FIELD_TYPE_META[option.value as ContentField['type']].description}
                          </Text>
                        </div>
                      )}
                      {...form.getInputProps(`fields.${index}.type`)}
                    />
                    <Switch
                      mt={30}
                      label="Required"
                      styles={{ label: { whiteSpace: 'nowrap' } }}
                      {...form.getInputProps(`fields.${index}.required`, { type: 'checkbox' })}
                    />
                    <Tooltip label="Remove field">
                      <ActionIcon
                        mt={28}
                        variant="subtle"
                        color="red"
                        aria-label="Remove field"
                        onClick={() => form.removeListItem('fields', index)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Card>
              ))
            )}
            <div>
              <Button
                type="button"
                variant="light"
                leftSection={<IconPlus size={16} />}
                onClick={addField}
              >
                Add field
              </Button>
            </div>
          </Stack>
        </div>

        <Group gap="sm">
          <Button type="submit" loading={busy}>
            {busy ? busyLabel : submitLabel}
          </Button>
          <Button component={Link} href="/admin/content" variant="subtle" color="slate">
            Cancel
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
