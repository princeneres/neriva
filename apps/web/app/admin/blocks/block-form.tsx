'use client';

import {
  ActionIcon,
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Group,
  JsonInput,
  List,
  Select,
  Stack,
  Switch,
  Tabs,
  TagsInput,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { randomId } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconPlus, IconTrash } from '@tabler/icons-react';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { HelpTip } from '../../../components/help-tip';
import { ApiError, type ProblemDetails } from '../../../lib/api';
import {
  type Block,
  type BlockPayload,
  type BuilderField,
  CATEGORY_SUGGESTIONS,
  FIELD_TYPE_OPTIONS,
  fieldsToSchema,
  schemaToFields,
  SLOT_NAME_PATTERN,
} from './types';

interface FieldRow extends BuilderField {
  uid: string;
}

interface SlotRow {
  uid: string;
  name: string;
  allowedBlocks?: string[];
}

interface FormValues {
  name: string;
  category: string;
  description: string;
  fields: FieldRow[];
  slots: SlotRow[];
}

const FIELD_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

function emptyField(): FieldRow {
  return { uid: randomId(), key: '', label: '', type: 'text', options: [], required: false };
}

function listIndex(path: string): number {
  return Number(path.split('.')[1]);
}

export function BlockForm({
  block,
  onSubmit,
}: {
  block?: Block;
  onSubmit: (payload: BlockPayload) => Promise<void>;
}) {
  // On edit, a schema the builder cannot represent opens straight in advanced mode.
  const initialFields = useMemo(() => (block ? schemaToFields(block.propsSchema) : []), [block]);
  const [advanced, setAdvanced] = useState(initialFields === null);
  const [activeTab, setActiveTab] = useState<string | null>(
    initialFields === null ? 'advanced' : 'builder',
  );
  const [schemaText, setSchemaText] = useState(() =>
    block ? JSON.stringify(block.propsSchema, null, 2) : '',
  );
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<ProblemDetails | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Validators are created once by useForm; read the latest mode via a ref.
  const advancedRef = useRef(advanced);
  advancedRef.current = advanced;

  const form = useForm<FormValues>({
    initialValues: {
      name: block?.name ?? '',
      category: block?.category ?? '',
      description: block?.description ?? '',
      fields: (initialFields ?? []).map((field) => ({ ...field, uid: randomId() })),
      slots: (block?.slots ?? []).map((slot) => ({ ...slot, uid: randomId() })),
    },
    validate: {
      name: (value) => (value.trim() ? null : 'Name is required'),
      fields: {
        key: (value, values, path) => {
          if (advancedRef.current) {
            return null;
          }
          const trimmed = value.trim();
          if (!trimmed) {
            return 'Key is required';
          }
          if (!FIELD_KEY_PATTERN.test(trimmed)) {
            return 'Use letters, numbers and underscores, starting with a letter';
          }
          const index = listIndex(path);
          const duplicate = values.fields.some(
            (field, i) => i !== index && field.key.trim() === trimmed,
          );
          return duplicate ? 'Each field needs a unique key' : null;
        },
        options: (value, values, path) => {
          if (advancedRef.current) {
            return null;
          }
          const field = values.fields[listIndex(path)];
          if (field?.type === 'choice' && value.length === 0) {
            return 'Add at least one option';
          }
          return null;
        },
      },
      slots: {
        name: (value, values, path) => {
          const trimmed = value.trim();
          if (!trimmed) {
            return 'Slot name is required';
          }
          if (!SLOT_NAME_PATTERN.test(trimmed)) {
            return 'Use lowercase letters, numbers and dashes, starting with a letter (for example: main-content)';
          }
          const index = listIndex(path);
          const duplicate = values.slots.some(
            (slot, i) => i !== index && slot.name.trim() === trimmed,
          );
          return duplicate ? 'Each slot needs a unique name' : null;
        },
      },
    },
  });

  const generatedSchemaText = useMemo(
    () => JSON.stringify(fieldsToSchema(form.values.fields), null, 2),
    [form.values.fields],
  );

  function onSchemaTextChange(value: string) {
    setSchemaText(value);
    setSchemaError(null);
    if (!advanced) {
      setAdvanced(true);
    }
  }

  function backToBuilder() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(schemaText) as unknown;
    } catch {
      notifications.show({ color: 'red', message: 'The schema is not valid JSON.' });
      return;
    }
    const fields = schemaToFields(parsed);
    if (fields === null) {
      notifications.show({
        color: 'red',
        message:
          'This schema uses features the builder cannot represent. Keep editing it in advanced mode.',
      });
      return;
    }
    form.setFieldValue(
      'fields',
      fields.map((field) => ({ ...field, uid: randomId() })),
    );
    setAdvanced(false);
    setSchemaError(null);
    setActiveTab('builder');
  }

  async function handleSubmit(values: FormValues) {
    let propsSchema: Record<string, unknown>;
    if (advanced) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(schemaText) as unknown;
      } catch {
        setSchemaError('This is not valid JSON');
        setActiveTab('advanced');
        return;
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setSchemaError('The schema must be a JSON object');
        setActiveTab('advanced');
        return;
      }
      propsSchema = parsed as Record<string, unknown>;
    } else {
      propsSchema = fieldsToSchema(values.fields);
    }

    const payload: BlockPayload = {
      name: values.name.trim(),
      category: values.category.trim() || undefined,
      description: values.description.trim() || undefined,
      propsSchema,
      slots: values.slots.map((slot) => ({
        name: slot.name.trim(),
        ...(slot.allowedBlocks && slot.allowedBlocks.length > 0
          ? { allowedBlocks: slot.allowedBlocks }
          : {}),
      })),
    };

    setSubmitting(true);
    setApiError(null);
    try {
      await onSubmit(payload);
    } catch (error) {
      if (error instanceof ApiError) {
        setApiError(error.problem);
        for (const message of error.problem.errors ?? []) {
          const field = ['name', 'category', 'description'].find((name) =>
            message.startsWith(name),
          );
          if (field) {
            form.setFieldError(field, message);
          }
        }
      } else {
        notifications.show({ color: 'red', message: 'Something went wrong. Please try again.' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.onSubmit((values) => void handleSubmit(values))}>
      {apiError ? (
        <Alert
          color="red"
          icon={<IconAlertTriangle size={16} />}
          title={apiError.title ?? 'The block could not be saved'}
          mb="md"
        >
          {apiError.detail ? <Text size="sm">{apiError.detail}</Text> : null}
          {apiError.errors && apiError.errors.length > 0 ? (
            <List size="sm" mt={4}>
              {apiError.errors.map((message) => (
                <List.Item key={message}>{message}</List.Item>
              ))}
            </List>
          ) : null}
        </Alert>
      ) : null}

      <Card padding="xl" mb="md">
        <Stack gap="md">
          <TextInput
            label={
              <span>
                Name
                <HelpTip label="What editors see when they pick this block for a page" />
              </span>
            }
            placeholder="Hero banner"
            withAsterisk
            {...form.getInputProps('name')}
          />
          <Autocomplete
            label={
              <span>
                Category
                <HelpTip label="Groups blocks in pickers. Pick a suggestion or type your own." />
              </span>
            }
            placeholder="layout"
            data={CATEGORY_SUGGESTIONS}
            {...form.getInputProps('category')}
          />
          <Textarea
            label={
              <span>
                Description
                <HelpTip label="A short note that helps editors choose the right block" />
              </span>
            }
            placeholder="Full-width banner with a title and a call to action"
            autosize
            minRows={2}
            {...form.getInputProps('description')}
          />
        </Stack>
      </Card>

      <Card padding="xl" mb="md">
        <Group gap={2} mb={2}>
          <Title order={3} fz="h4">
            Fields
          </Title>
          <HelpTip label="The fields editors fill in when they use this block" />
        </Group>
        <Text size="sm" c="slate.5" mb="md">
          A hero block might have a title and a button label. Behind the scenes this becomes a JSON
          Schema, but you do not need to write it.
        </Text>

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List mb="md">
            <Tabs.Tab value="builder">Builder</Tabs.Tab>
            <Tabs.Tab value="advanced">Advanced</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="builder">
            {advanced ? (
              <Alert color="yellow" icon={<IconAlertTriangle size={16} />}>
                <Text size="sm" mb="xs">
                  This schema was edited manually, so the form is in advanced mode. The builder can
                  only represent a simple list of fields.
                </Text>
                <Button size="xs" variant="light" color="yellow" onClick={backToBuilder}>
                  Try the builder anyway
                </Button>
              </Alert>
            ) : (
              <Stack gap="sm">
                {form.values.fields.map((field, index) => (
                  <Card key={field.uid} padding="md" radius="md" bg="slate.0">
                    <Group gap="sm" align="flex-start" wrap="wrap">
                      <TextInput
                        flex={1}
                        miw={140}
                        label={
                          <span>
                            Key
                            <HelpTip label="The technical name stored in page data. Editors never see it." />
                          </span>
                        }
                        placeholder="title"
                        {...form.getInputProps(`fields.${index}.key`)}
                      />
                      <TextInput
                        flex={1}
                        miw={140}
                        label={
                          <span>
                            Label
                            <HelpTip label="Shown to editors next to the input when they fill this field" />
                          </span>
                        }
                        placeholder="Title"
                        {...form.getInputProps(`fields.${index}.label`)}
                      />
                      <Select
                        w={130}
                        label="Type"
                        data={FIELD_TYPE_OPTIONS}
                        allowDeselect={false}
                        {...form.getInputProps(`fields.${index}.type`)}
                      />
                      <Switch
                        mt={34}
                        label={
                          <span>
                            Required
                            <HelpTip label="Editors must fill this field before the page can be saved" />
                          </span>
                        }
                        {...form.getInputProps(`fields.${index}.required`, {
                          type: 'checkbox',
                        })}
                      />
                      <Tooltip label="Remove field">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          mt={32}
                          aria-label="Remove field"
                          onClick={() => form.removeListItem('fields', index)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                    {field.type === 'choice' ? (
                      <TagsInput
                        mt="sm"
                        label={
                          <span>
                            Options
                            <HelpTip label="The values editors can choose from. Type one and press Enter." />
                          </span>
                        }
                        placeholder="Type an option and press Enter"
                        {...form.getInputProps(`fields.${index}.options`)}
                      />
                    ) : null}
                  </Card>
                ))}
                <Box>
                  <Button
                    variant="light"
                    leftSection={<IconPlus size={16} />}
                    onClick={() => form.insertListItem('fields', emptyField())}
                  >
                    Add field
                  </Button>
                </Box>
              </Stack>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="advanced">
            <Stack gap="sm">
              {advanced ? (
                <Alert color="yellow" icon={<IconAlertTriangle size={16} />}>
                  Advanced mode: the schema below is saved exactly as written. The builder cannot
                  represent every schema, so manual edits keep the form in this mode.
                </Alert>
              ) : (
                <Text size="sm" c="slate.5">
                  This is the JSON Schema the builder generates. Editing it switches the form to
                  advanced mode.
                </Text>
              )}
              <JsonInput
                label={
                  <span>
                    propsSchema
                    <HelpTip label="JSON Schema (draft 2020-12) describing the fields of this block. The API validates it on save." />
                  </span>
                }
                autosize
                minRows={10}
                validationError="This is not valid JSON"
                value={advanced ? schemaText : generatedSchemaText}
                onChange={onSchemaTextChange}
                error={schemaError}
              />
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Card>

      <Card padding="xl" mb="lg">
        <Group gap={2} mb={2}>
          <Title order={3} fz="h4">
            Slots
          </Title>
          <HelpTip label="Spaces inside the block where other blocks can be nested" />
        </Group>
        <Text size="sm" c="slate.5" mb="md">
          A two-column block could declare a left and a right slot. Leave this empty if nothing
          nests inside the block.
        </Text>
        <Stack gap="sm">
          {form.values.slots.map((slot, index) => (
            <Group key={slot.uid} gap="sm" align="flex-start">
              <TextInput
                flex={1}
                maw={320}
                label={
                  <span>
                    Slot name
                    <HelpTip label="Lowercase letters, numbers and dashes, starting with a letter (for example: main, sidebar). Pages refer to the slot by this name." />
                  </span>
                }
                placeholder="main"
                {...form.getInputProps(`slots.${index}.name`)}
              />
              <Tooltip label="Remove slot">
                <ActionIcon
                  variant="subtle"
                  color="red"
                  mt={32}
                  aria-label="Remove slot"
                  onClick={() => form.removeListItem('slots', index)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          ))}
          <Box>
            <Button
              variant="light"
              leftSection={<IconPlus size={16} />}
              onClick={() => form.insertListItem('slots', { uid: randomId(), name: '' })}
            >
              Add slot
            </Button>
          </Box>
        </Stack>
      </Card>

      <Group>
        <Button type="submit" loading={submitting}>
          {block ? 'Save changes' : 'Create block'}
        </Button>
        <Button component={Link} href="/admin/blocks" variant="subtle" color="gray">
          Cancel
        </Button>
      </Group>
    </form>
  );
}
