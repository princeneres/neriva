'use client';

import {
  ActionIcon,
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Code,
  Collapse,
  Grid,
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
  UnstyledButton,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { randomId, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconInfoCircle,
  IconPlus,
  IconTrash,
  IconWand,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { HelpTip } from '../../../components/help-tip';
import { ApiError, type ProblemDetails } from '../../../lib/api';
import { BlockPreviewPanel, schemaTextToPreviewFields } from './block-preview';
import {
  type Block,
  BLOCK_DRAFT_STORAGE_KEY,
  type BlockDraft,
  type BlockPayload,
  type BuilderField,
  CATEGORY_SUGGESTIONS,
  FIELD_TYPE_OPTIONS,
  fieldsToSchema,
  NATIVE_BLOCK_ERC_PREFIX,
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

const HTML_PLACEHOLDER = `<section class="promo">
  <h2 data-nv-text="title">{{title}}</h2>
  <p data-nv-rich="body"></p>
  <div data-nv-slot="content"></div>
</section>`;

const CSS_PLACEHOLDER = `.promo {
  padding: var(--nv-space-lg, 2rem);
  color: var(--nv-color-text, #1a1917);
}`;

const MONO_INPUT = { input: { fontFamily: 'var(--font-mono), monospace' } };

const SYNTAX_ROWS: { code: string; text: string }[] = [
  { code: '{{prop}}', text: 'Inserts the field value, always HTML-escaped.' },
  {
    code: 'data-nv-text="prop"',
    text: 'Binds the element text to a field as plain text. Bound elements become inline-editable on the page editor canvas.',
  },
  {
    code: 'data-nv-rich="prop"',
    text: 'Binds sanitized rich text (p, br, b, strong, i, em, a, ul, ol, li). Also inline-editable.',
  },
  {
    code: 'data-nv-image="prop"',
    text: 'Sets the src from a field; add data-nv-alt="otherProp" for the alt text.',
  },
  { code: 'data-nv-link="prop"', text: 'Sets the href from a field.' },
  {
    code: 'data-nv-slot="name"',
    text: 'Marks an EMPTY element as a slot: nested blocks render there. The name must be declared in Slots below.',
  },
  {
    code: 'data-nv-embed="prop"',
    text: 'Renders a sandboxed player for a YouTube or Vimeo URL field.',
  },
];

function TemplateSyntaxHelp() {
  const [opened, { toggle }] = useDisclosure(false);
  return (
    <Card padding="md" radius="md" bg="slate.0">
      <UnstyledButton onClick={toggle} aria-expanded={opened} w="100%">
        <Group gap={6}>
          {opened ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          <Text size="sm" fw={600}>
            Template syntax
          </Text>
        </Group>
      </UnstyledButton>
      <Collapse in={opened}>
        <Stack gap={6} mt="sm">
          {SYNTAX_ROWS.map((row) => (
            <Text key={row.code} size="sm">
              <Code>{row.code}</Code> {row.text}
            </Text>
          ))}
          <Text size="sm">
            The CSS is scoped to this block automatically and can use style book tokens, for example{' '}
            <Code>{'var(--nv-color-primary)'}</Code> or <Code>{'var(--nv-space-md)'}</Code>.
          </Text>
          <Text size="sm" c="slate.5">
            On save the API rejects templates that break the rules: bindings only on elements
            without nested tags, slot elements empty, bound props declared as fields, and no
            scripts, iframes or event handlers.
          </Text>
        </Stack>
      </Collapse>
    </Card>
  );
}

function starterTemplate(fields: BuilderField[], slotNames: string[]): string {
  const usable = fields.filter((field) => field.key.trim()).slice(0, 4);
  const heading = usable.find((field) => /title|heading|name/i.test(field.key)) ?? usable[0];
  const body = usable.find(
    (field) => field !== heading && /body|text|description|summary/i.test(field.key),
  );
  const lines = ['<section class="block">'];
  if (heading) lines.push(`  <h2 data-nv-text="${heading.key}">{{${heading.key}}}</h2>`);
  if (body) lines.push(`  <p data-nv-rich="${body.key}"></p>`);
  for (const field of usable) {
    if (field !== heading && field !== body) {
      lines.push(
        `  <div class="block-field"><span>${field.label || field.key}</span><strong data-nv-text="${field.key}">{{${field.key}}}</strong></div>`,
      );
    }
  }
  for (const slot of slotNames) lines.push(`  <div data-nv-slot="${slot}"></div>`);
  lines.push('</section>');
  return lines.join('\n');
}

function TemplateMapping({
  fields,
  slotNames,
  html,
  onUseStarter,
}: {
  fields: BuilderField[];
  slotNames: string[];
  html: string;
  onUseStarter: () => void;
}) {
  const bindingFor = (key: string) => {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = html.match(
      new RegExp(
        `(?:data-nv-(text|rich|image|link|embed)=["']${escaped}["']|\\{\\{${escaped}\\}\\})`,
      ),
    );
    return match?.[1] ? `data-nv-${match[1]}` : match ? 'interpolation' : null;
  };
  const connected = fields.filter((field) => bindingFor(field.key)).length;
  return (
    <Card padding="md" radius="md" bg="slate.0" withBorder>
      <Group justify="space-between" align="flex-start" gap="sm">
        <Box>
          <Group gap={6}>
            <Title order={4} fz="h5">
              Data mapping
            </Title>
            <HelpTip label="See how each field in the data contract reaches the HTML preview" />
          </Group>
          <Text size="xs" c="slate.5" mt={2}>
            {connected} of {fields.length} fields connected. A field becomes visible when its key is
            bound in the template.
          </Text>
        </Box>
        <Button
          type="button"
          size="xs"
          variant="light"
          leftSection={<IconWand size={14} />}
          onClick={onUseStarter}
        >
          Use starter template
        </Button>
      </Group>
      <Stack gap={6} mt="sm">
        {fields.length === 0 ? (
          <Text size="xs" c="slate.5">
            Add fields in Builder to create a data contract.
          </Text>
        ) : (
          fields.map((field) => {
            const binding = bindingFor(field.key);
            return (
              <Group key={field.key} gap="xs" wrap="nowrap">
                {binding ? (
                  <IconCheck size={15} color="var(--mantine-color-green-6)" />
                ) : (
                  <span style={{ width: 15 }} />
                )}
                <Code>{field.key}</Code>
                <Text size="xs" c="slate.5">
                  →
                </Text>
                <Text size="xs" fw={600} c={binding ? 'slate.7' : 'slate.5'}>
                  {binding ?? 'Not used yet'}
                </Text>
              </Group>
            );
          })
        )}
        {slotNames.length > 0 ? (
          <Text size="xs" c="slate.5" mt={4}>
            Slots:{' '}
            {slotNames.map((slot) => (
              <Code key={slot} mr={4}>
                {slot}
              </Code>
            ))}
          </Text>
        ) : null}
      </Stack>
    </Card>
  );
}

export function BlockForm({
  block,
  initial,
  onSubmit,
}: {
  block?: Block;
  // Pre-filled values for the create form (duplicate handoff); ignored on edit.
  initial?: BlockDraft;
  onSubmit: (payload: BlockPayload) => Promise<void>;
}) {
  const router = useRouter();
  const source: Block | BlockDraft | undefined = block ?? initial;
  // On edit, a schema the builder cannot represent opens straight in advanced mode.
  const initialFields = useMemo(() => (source ? schemaToFields(source.propsSchema) : []), [source]);
  const [advanced, setAdvanced] = useState(initialFields === null);
  const [activeTab, setActiveTab] = useState<string | null>(
    initialFields === null ? 'advanced' : 'builder',
  );
  const [schemaText, setSchemaText] = useState(() =>
    source ? JSON.stringify(source.propsSchema, null, 2) : '',
  );
  const [html, setHtml] = useState(source?.html ?? '');
  const [css, setCss] = useState(source?.css ?? '');
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<ProblemDetails | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Validators are created once by useForm; read the latest mode via a ref.
  const advancedRef = useRef(advanced);
  advancedRef.current = advanced;

  const form = useForm<FormValues>({
    initialValues: {
      name: source?.name ?? '',
      category: source?.category ?? '',
      description: source?.description ?? '',
      fields: (initialFields ?? []).map((field) => ({ ...field, uid: randomId() })),
      slots: (source?.slots ?? []).map((slot) => ({ ...slot, uid: randomId() })),
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

  // In builder mode the preview follows the rows directly; in advanced mode
  // sample fields are derived from the manual schema (null hides the preview).
  const previewFields: BuilderField[] | null = advanced
    ? schemaTextToPreviewFields(schemaText)
    : form.values.fields;

  const previewSlotNames = useMemo(() => {
    const names: string[] = [];
    for (const slot of form.values.slots) {
      const name = slot.name.trim();
      if (name && SLOT_NAME_PATTERN.test(name) && !names.includes(name)) {
        names.push(name);
      }
    }
    return names;
  }, [form.values.slots]);

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
      html: html.trim() === '' ? null : html,
      css: css.trim() === '' ? null : css,
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

  const isNativeBlock =
    block !== undefined && block.externalReferenceCode.startsWith(NATIVE_BLOCK_ERC_PREFIX);

  // Hands the current form values (including unsaved edits) to the create
  // form; invalid manual schema falls back to the stored one.
  function duplicateBlock() {
    if (!block) {
      return;
    }
    let propsSchema: Record<string, unknown> = block.propsSchema;
    if (advanced) {
      try {
        const parsed = JSON.parse(schemaText) as unknown;
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          propsSchema = parsed as Record<string, unknown>;
        }
      } catch {
        // keep the stored schema
      }
    } else {
      propsSchema = fieldsToSchema(form.values.fields);
    }
    const draft: BlockDraft = {
      name: `${form.values.name.trim() || block.name} (copy)`,
      category: form.values.category.trim() || null,
      description: form.values.description.trim() || null,
      propsSchema,
      slots: form.values.slots.map((slot) => ({
        name: slot.name.trim(),
        ...(slot.allowedBlocks && slot.allowedBlocks.length > 0
          ? { allowedBlocks: slot.allowedBlocks }
          : {}),
      })),
      html: html.trim() === '' ? null : html,
      css: css.trim() === '' ? null : css,
    };
    sessionStorage.setItem(BLOCK_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    router.push('/admin/blocks/new');
  }

  return (
    <form onSubmit={form.onSubmit((values) => void handleSubmit(values))}>
      {isNativeBlock ? (
        <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />} mb="md">
          <Group justify="space-between" align="center" gap="sm" wrap="wrap">
            <Text size="sm">
              This is a built-in block. Consider duplicating it so updates do not surprise existing
              pages.
            </Text>
            <Button
              type="button"
              size="xs"
              variant="light"
              leftSection={<IconCopy size={14} />}
              onClick={duplicateBlock}
            >
              Duplicate
            </Button>
          </Group>
        </Alert>
      ) : null}
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

      <Grid gutter="lg" align="flex-start">
        <Grid.Col span={{ base: 12, lg: 7 }}>
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
              A hero block might have a title and a button label. Behind the scenes this becomes a
              JSON Schema, but you do not need to write it.
            </Text>

            <Tabs value={activeTab} onChange={setActiveTab}>
              <Tabs.List mb="md">
                <Tabs.Tab value="builder">Builder</Tabs.Tab>
                <Tabs.Tab value="advanced">Advanced</Tabs.Tab>
                <Tabs.Tab value="code">Code</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="builder">
                {advanced ? (
                  <Alert color="yellow" icon={<IconAlertTriangle size={16} />}>
                    <Text size="sm" mb="xs">
                      This schema was edited manually, so the form is in advanced mode. The builder
                      can only represent a simple list of fields.
                    </Text>
                    <Button
                      type="button"
                      size="xs"
                      variant="light"
                      color="yellow"
                      onClick={backToBuilder}
                    >
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
                        type="button"
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
                      Advanced mode: the schema below is saved exactly as written. The builder
                      cannot represent every schema, so manual edits keep the form in this mode.
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

              <Tabs.Panel value="code">
                <Stack gap="sm">
                  <Text size="sm" c="slate.5">
                    Define the block as a small, portable template. The preview on the right uses
                    the same HTML engine as the public site, so every mapping is visible while you
                    work.
                  </Text>
                  <Textarea
                    label={
                      <span>
                        HTML
                        <HelpTip label="The markup this block renders. Use {{prop}} and data-nv-* bindings to pull in field values." />
                      </span>
                    }
                    autosize
                    minRows={12}
                    spellCheck={false}
                    styles={MONO_INPUT}
                    placeholder={HTML_PLACEHOLDER}
                    value={html}
                    onChange={(event) => setHtml(event.currentTarget.value)}
                  />
                  <Textarea
                    label={
                      <span>
                        CSS
                        <HelpTip label="Styles for this block only; selectors are scoped automatically. Style book tokens are available as var(--nv-*)." />
                      </span>
                    }
                    autosize
                    minRows={12}
                    spellCheck={false}
                    styles={MONO_INPUT}
                    placeholder={CSS_PLACEHOLDER}
                    value={css}
                    onChange={(event) => setCss(event.currentTarget.value)}
                  />
                  <TemplateSyntaxHelp />
                  <TemplateMapping
                    fields={previewFields ?? []}
                    slotNames={previewSlotNames}
                    html={html}
                    onUseStarter={() => {
                      setHtml(starterTemplate(previewFields ?? [], previewSlotNames));
                      if (css.trim() === '') {
                        setCss(CSS_PLACEHOLDER);
                      }
                    }}
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
                  type="button"
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
            <Button
              type="button"
              component={Link}
              href="/admin/blocks"
              variant="subtle"
              color="gray"
            >
              Cancel
            </Button>
          </Group>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Box style={{ position: 'sticky', top: 'var(--mantine-spacing-xl)' }}>
            <BlockPreviewPanel
              erc={block?.externalReferenceCode ?? 'preview'}
              blockName={form.values.name.trim() || 'New block'}
              fields={previewFields}
              slotNames={previewSlotNames}
              html={html}
              css={css}
            />
          </Box>
        </Grid.Col>
      </Grid>
    </form>
  );
}
