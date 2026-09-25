'use client';

import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Card,
  Group,
  Radio,
  Select,
  Stack,
  Switch,
  TagsInput,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertTriangle, IconPlus, IconTrash } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';
import { HelpTip } from '../../../components/help-tip';
import { ApiError } from '../../../lib/api';
import {
  FIELD_KEY_PATTERN,
  FIELD_TYPE_OPTIONS,
  PUBLIC_ACCESS_OPTIONS,
  type ObjectField,
  type ObjectFieldType,
  type ObjectPublicAccess,
} from './types';

export interface DefinitionFormValues {
  name: string;
  pluralName: string;
  description: string;
  publicAccess: ObjectPublicAccess;
  fields: ObjectField[];
}

interface FieldRow {
  key: string;
  label: string;
  type: ObjectFieldType;
  required: boolean;
  options: string[];
}

interface FormValues {
  name: string;
  pluralName: string;
  description: string;
  publicAccess: ObjectPublicAccess;
  fields: FieldRow[];
}

const KEY_HINT = 'Start with a lowercase letter, then letters or digits (e.g. firstName)';

function toRows(fields: ObjectField[]): FieldRow[] {
  return fields.map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    options: field.options ?? [],
  }));
}

// Maps problem `errors[]` entries to top-level form fields by prefix.
function matchTopLevelField(message: string): string | null {
  const lower = message.toLowerCase();
  for (const field of ['pluralName', 'name', 'description', 'fields']) {
    if (lower.startsWith(field.toLowerCase())) {
      return field;
    }
  }
  return null;
}

export function DefinitionForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: DefinitionFormValues;
  submitLabel: string;
  onSubmit: (values: DefinitionFormValues) => Promise<void>;
}) {
  const [formError, setFormError] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const form = useForm<FormValues>({
    initialValues: {
      name: initial?.name ?? '',
      pluralName: initial?.pluralName ?? '',
      description: initial?.description ?? '',
      // Fail closed: a form with no initial value creates a private object.
      publicAccess: initial?.publicAccess ?? 'none',
      fields: toRows(initial?.fields ?? []),
    },
    validate: {
      name: (value) => (value.trim() === '' ? 'Name is required' : null),
      pluralName: (value) => (value.trim() === '' ? 'Plural name is required' : null),
      fields: {
        key: (value, values, path) => {
          if (!FIELD_KEY_PATTERN.test(value)) {
            return KEY_HINT;
          }
          const index = Number(path.split('.')[1]);
          const isDuplicate = values.fields.some(
            (row, rowIndex) => rowIndex < index && row.key === value,
          );
          return isDuplicate ? `Duplicate key "${value}"` : null;
        },
        label: (value) => (value.trim() === '' ? 'Label is required' : null),
        options: (value, values, path) => {
          const index = Number(path.split('.')[1]);
          if (values.fields[index]?.type === 'picklist' && value.length === 0) {
            return 'Add at least one choice';
          }
          return null;
        },
      },
    },
  });

  function addField() {
    form.insertListItem('fields', {
      key: '',
      label: '',
      type: 'text',
      required: false,
      options: [],
    } satisfies FieldRow);
  }

  async function handleSubmit(values: FormValues) {
    setFormError(null);
    setBusy(true);
    try {
      await onSubmit({
        name: values.name,
        pluralName: values.pluralName,
        description: values.description,
        publicAccess: values.publicAccess,
        fields: values.fields.map((row) => ({
          key: row.key,
          label: row.label,
          type: row.type,
          required: row.required,
          ...(row.type === 'picklist' ? { options: row.options } : {}),
        })),
      });
    } catch (err) {
      if (err instanceof ApiError) {
        const unmapped: string[] = [];
        for (const message of err.problem.errors ?? []) {
          const field = matchTopLevelField(message);
          if (field) {
            form.setFieldError(field, message);
          } else {
            unmapped.push(message);
          }
        }
        setFormError([err.message, ...unmapped]);
      } else {
        setFormError(['Saving the object failed. Please try again.']);
      }
      setBusy(false);
    }
  }

  return (
    <form onSubmit={form.onSubmit((values) => void handleSubmit(values))}>
      <Stack gap="md">
        {formError ? (
          <Alert color="red" title="Could not save">
            {formError.map((message) => (
              <Text key={message} size="sm">
                {message}
              </Text>
            ))}
          </Alert>
        ) : null}

        <TextInput
          label={
            <>
              Name
              <HelpTip label="What one item is called, e.g. Product or Lead" />
            </>
          }
          placeholder="Product"
          withAsterisk
          maxLength={255}
          {...form.getInputProps('name')}
        />
        <TextInput
          label={
            <>
              Plural name
              <HelpTip label="Used when listing many items, e.g. Products or Leads" />
            </>
          }
          placeholder="Products"
          withAsterisk
          maxLength={255}
          {...form.getInputProps('pluralName')}
        />
        <Textarea
          label={
            <>
              Description
              <HelpTip label="A note for your team about what this table stores. Optional." />
            </>
          }
          placeholder="What does this table store?"
          autosize
          minRows={2}
          {...form.getInputProps('description')}
        />

        <Box>
          <Group gap={4} mb={4}>
            <Text component="span" fw={600} size="sm">
              Who can see this
            </Text>
            <HelpTip label="Controls what visitors who are not signed in can do with these records on your website" />
          </Group>
          <Radio.Group
            value={form.values.publicAccess}
            onChange={(value) => form.setFieldValue('publicAccess', value as ObjectPublicAccess)}
          >
            <Stack gap="xs">
              {PUBLIC_ACCESS_OPTIONS.map((option) => (
                <Radio
                  key={option.value}
                  value={option.value}
                  label={option.label}
                  description={option.description}
                />
              ))}
            </Stack>
          </Radio.Group>
          {form.values.publicAccess === 'read-write' ? (
            <Alert
              mt="sm"
              color="orange"
              icon={<IconAlertTriangle size={18} />}
              title="Anyone on the internet can write here"
            >
              <Text size="sm">
                There is no account behind an anonymous write, so there is no way to tell two
                visitors apart: any visitor can edit or delete any record in this object, including
                records other people added. That is what makes a shared demo list work, and it is
                the wrong setting for anything you would not publish on a public page.
              </Text>
            </Alert>
          ) : null}
          {form.values.publicAccess === 'read' ? (
            <Alert mt="sm" color="blue" title="These records become public">
              <Text size="sm">
                Anyone can list every record in this object without signing in. Nobody can change
                them.
              </Text>
            </Alert>
          ) : null}
        </Box>

        <Box>
          <Group gap={4} mb={4}>
            <Text component="span" fw={600} size="sm">
              Fields
            </Text>
            <HelpTip label="Each field is a column of your table: a short key for the API, a label people see, and the kind of value it holds" />
          </Group>
          <Stack gap="sm">
            {form.values.fields.map((row, index) => (
              // Rows are index-keyed: @mantine/form list helpers address rows by position.
              <Card key={index} padding="md" bg="slate.0">
                <Group align="flex-start" gap="sm" wrap="wrap">
                  <TextInput
                    style={{ flex: 1, minWidth: 160 }}
                    aria-label="Field key"
                    label={
                      <>
                        Key
                        <HelpTip label="Internal name used by the API, e.g. firstName" />
                      </>
                    }
                    placeholder="price"
                    {...form.getInputProps(`fields.${index}.key`)}
                  />
                  <TextInput
                    style={{ flex: 1, minWidth: 160 }}
                    aria-label="Field label"
                    label={
                      <>
                        Label
                        <HelpTip label="The name people see in forms and tables" />
                      </>
                    }
                    placeholder="Price"
                    {...form.getInputProps(`fields.${index}.label`)}
                  />
                  <Select
                    w={140}
                    aria-label="Field type"
                    label={
                      <>
                        Type
                        <HelpTip label="What kind of value this column holds" />
                      </>
                    }
                    data={FIELD_TYPE_OPTIONS}
                    allowDeselect={false}
                    {...form.getInputProps(`fields.${index}.type`)}
                  />
                  {row.type === 'picklist' ? (
                    <TagsInput
                      style={{ flex: 1, minWidth: 180 }}
                      aria-label="Choices"
                      label={
                        <>
                          Choices
                          <HelpTip label="The allowed values. Type one and press Enter to add it." />
                        </>
                      }
                      placeholder="Type and press Enter"
                      {...form.getInputProps(`fields.${index}.options`)}
                    />
                  ) : null}
                  <Switch
                    mt={30}
                    label="Required"
                    {...form.getInputProps(`fields.${index}.required`, { type: 'checkbox' })}
                  />
                  <Tooltip label="Remove this field">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      mt={28}
                      aria-label="Remove field"
                      onClick={() => form.removeListItem('fields', index)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Card>
            ))}
            {form.values.fields.length === 0 ? (
              <Text size="sm" c="slate.5">
                No fields yet. Add the columns this table should have.
              </Text>
            ) : null}
            <Group>
              <Button
                variant="light"
                leftSection={<IconPlus size={16} />}
                onClick={addField}
                type="button"
              >
                Add field
              </Button>
            </Group>
          </Stack>
        </Box>

        <Group mt="sm">
          <Button type="submit" loading={busy}>
            {submitLabel}
          </Button>
          <Button component={Link} href="/admin/objects" variant="subtle" color="gray">
            Cancel
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
