'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Code,
  Grid,
  Group,
  JsonInput,
  Paper,
  Select,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconCheck,
  IconCode,
  IconDeviceFloppy,
  IconPlus,
  IconRefresh,
  IconRestore,
  IconTrash,
} from '@tabler/icons-react';
import { randomId } from '@mantine/hooks';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, type ProblemDetails } from '../../../lib/api';
import { collectTemplateBindings } from '../../../lib/renderer/template';
import { BlockPreviewPanel, schemaTextToPreviewFields } from './block-preview';
import { CodeEditor } from './code-editor';
import classes from './block-studio.module.css';
import {
  type Block,
  type BlockDraft,
  type BlockPayload,
  type BlockSlot,
  type BuilderField,
  CATEGORY_SUGGESTIONS,
  FIELD_TYPE_OPTIONS,
  fieldsToSchema,
  schemaToFields,
  SLOT_NAME_PATTERN,
} from './types';

interface FieldRow extends BuilderField {
  id: string;
}

interface StudioState {
  name: string;
  category: string;
  description: string;
  fields: FieldRow[];
  slots: BlockSlot[];
  html: string | null;
  css: string | null;
  js: string | null;
  schemaText: string;
  advancedSchema: boolean;
}

const FIELD_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createField(key = ''): FieldRow {
  return {
    id: randomId(),
    key,
    label: key === '' ? '' : key.replace(/[-_]/g, ' '),
    description: '',
    type: 'text',
    options: [],
    required: false,
  };
}

function makeState(source?: Block | BlockDraft): StudioState {
  const parsed = source ? schemaToFields(source.propsSchema) : [];
  return {
    name: source?.name ?? '',
    category: source?.category ?? '',
    description: source?.description ?? '',
    fields: (parsed ?? []).map((field) => ({ ...field, id: randomId() })),
    slots: clone(source?.slots ?? []),
    html: source?.html ?? null,
    css: source?.css ?? null,
    js: source?.js ?? null,
    schemaText: JSON.stringify(source?.propsSchema ?? fieldsToSchema([]), null, 2),
    advancedSchema: parsed === null,
  };
}

function comparable(state: StudioState): Omit<StudioState, 'fields'> & { fields: BuilderField[] } {
  return {
    ...state,
    fields: state.fields.map(({ id: _id, ...field }) => field),
  };
}

function fieldKeys(fields: FieldRow[]): Set<string> {
  return new Set(fields.map((field) => field.key.trim()).filter(Boolean));
}

function fieldValidation(fields: FieldRow[]): string | null {
  const seen = new Set<string>();
  for (const field of fields) {
    const key = field.key.trim();
    if (!FIELD_KEY_PATTERN.test(key)) {
      return 'Field keys must start with a letter and use only letters, numbers, or underscores.';
    }
    if (seen.has(key)) {
      return `The field "${key}" appears more than once.`;
    }
    if (field.type === 'choice' && field.options.length === 0) {
      return `The choice field "${key}" needs at least one option.`;
    }
    seen.add(key);
  }
  return null;
}

function slotValidation(slots: BlockSlot[]): string | null {
  const seen = new Set<string>();
  for (const slot of slots) {
    if (!SLOT_NAME_PATTERN.test(slot.name)) {
      return 'Slot names use lowercase letters, numbers, and dashes, starting with a letter.';
    }
    if (seen.has(slot.name)) return `The slot "${slot.name}" appears more than once.`;
    seen.add(slot.name);
  }
  return null;
}

function sourceValidation(html: string | null): string | null {
  if (html === null || html.trim() === '') return null;
  const opens = (html.match(/</g) ?? []).length;
  const closes = (html.match(/>/g) ?? []).length;
  return opens === closes
    ? null
    : 'The HTML contains an incomplete tag. Save will run the full server validation.';
}

export function BlockForm({
  block,
  initial,
  onSubmit,
  onRestoreNative,
}: {
  block?: Block;
  initial?: BlockDraft;
  onSubmit: (payload: BlockPayload) => Promise<Block>;
  onRestoreNative?: () => Promise<Block>;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<StudioState>(() => makeState(block ?? initial));
  const [draft, setDraft] = useState<StudioState>(() => makeState(block ?? initial));
  const [activeTab, setActiveTab] = useState<string | null>('code');
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<ProblemDetails | null>(null);

  const dirty = JSON.stringify(comparable(draft)) !== JSON.stringify(comparable(saved));
  const bindings = useMemo(() => collectTemplateBindings(draft.html ?? ''), [draft.html]);
  const schemaFields = draft.advancedSchema
    ? schemaTextToPreviewFields(draft.schemaText)
    : draft.fields;
  const schemaKeys = useMemo(() => fieldKeys(draft.fields), [draft.fields]);
  const detected = bindings.props;
  const missingFields = detected.filter((key) => !schemaKeys.has(key));
  const unusedFields = draft.fields.filter((field) => !detected.includes(field.key.trim()));
  const slots = draft.slots.map((slot) => slot.name).filter((name) => SLOT_NAME_PATTERN.test(name));
  const nativeAvailable =
    typeof block?.nativeHtml === 'string' && typeof block?.nativeCss === 'string';
  const sourceState =
    nativeAvailable &&
    draft.html === block.nativeHtml &&
    draft.css === block.nativeCss &&
    draft.js === block.nativeJs
      ? 'NATIVE'
      : 'CUSTOM';
  const sourceWarning = sourceValidation(draft.html);

  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function update(next: Partial<StudioState>) {
    setDraft((current) => ({ ...current, ...next }));
    setProblem(null);
  }

  function resetChanges() {
    setDraft(clone(saved));
    setProblem(null);
    notifications.show({ color: 'blue', message: 'Unsaved changes were discarded.' });
  }

  function leaveStudio() {
    if (!dirty || window.confirm('You have unsaved changes. Leave the Block Studio?')) {
      router.push('/admin/blocks');
    }
  }

  function addDetectedField(key: string) {
    if (draft.advancedSchema) {
      notifications.show({
        color: 'yellow',
        message: 'Add this binding in the raw schema while advanced schema mode is active.',
      });
      setActiveTab('schema');
      return;
    }
    setDraft((current) => ({ ...current, fields: [...current.fields, createField(key)] }));
  }

  function buildPayload(): BlockPayload | null {
    if (draft.name.trim() === '') {
      setProblem({
        type: 'validation',
        title: 'Block name required',
        status: 400,
        detail: 'Give this Block a name before saving.',
      });
      return null;
    }
    if (!block && (draft.html === null || draft.html.trim() === '')) {
      setProblem({
        type: 'validation',
        title: 'HTML source required',
        status: 400,
        detail: 'A custom Block needs its real HTML source before it can be created.',
      });
      setActiveTab('code');
      return null;
    }
    const slotError = slotValidation(draft.slots);
    if (slotError) {
      setProblem({ type: 'validation', title: 'Invalid slots', status: 400, detail: slotError });
      setActiveTab('fields');
      return null;
    }
    let propsSchema: Record<string, unknown>;
    if (draft.advancedSchema) {
      try {
        const parsed = JSON.parse(draft.schemaText) as unknown;
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
          throw new Error();
        propsSchema = parsed as Record<string, unknown>;
      } catch {
        setProblem({
          type: 'validation',
          title: 'Invalid schema',
          status: 400,
          detail: 'Schema must be a JSON object.',
        });
        setActiveTab('schema');
        return null;
      }
    } else {
      const error = fieldValidation(draft.fields);
      if (error) {
        setProblem({ type: 'validation', title: 'Invalid fields', status: 400, detail: error });
        setActiveTab('fields');
        return null;
      }
      propsSchema = fieldsToSchema(draft.fields);
    }
    return {
      name: draft.name.trim(),
      category: draft.category.trim() || undefined,
      description: draft.description.trim() || undefined,
      propsSchema,
      slots: draft.slots.map((slot) => ({
        name: slot.name,
        ...(slot.allowedBlocks && slot.allowedBlocks.length > 0
          ? { allowedBlocks: slot.allowedBlocks }
          : {}),
      })),
      html: draft.html?.trim() === '' ? null : draft.html,
      css: draft.css?.trim() === '' ? null : draft.css,
      js: draft.js?.trim() === '' ? null : draft.js,
    };
  }

  async function save() {
    const payload = buildPayload();
    if (!payload) return;
    setSubmitting(true);
    setProblem(null);
    try {
      const savedBlock = await onSubmit(payload);
      const next = makeState(savedBlock);
      setSaved(next);
      setDraft(next);
      notifications.show({ color: 'green', message: 'Changes saved.' });
    } catch (error) {
      if (error instanceof ApiError) {
        setProblem(error.problem);
      } else {
        setProblem({
          type: 'error',
          title: 'Save failed',
          status: 500,
          detail: 'The Block could not be saved. Try again.',
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function restoreNative() {
    if (!onRestoreNative || !nativeAvailable) return;
    if (
      !window.confirm(
        'Restore the Neriva HTML and CSS for this Block? Your saved custom source will be replaced.',
      )
    )
      return;
    setSubmitting(true);
    try {
      const restored = await onRestoreNative();
      const next = makeState(restored);
      setSaved(next);
      setDraft(next);
      notifications.show({ color: 'green', message: 'Native template restored.' });
    } catch (error) {
      setProblem(
        error instanceof ApiError
          ? error.problem
          : {
              type: 'error',
              title: 'Restore failed',
              status: 500,
              detail: 'The native template could not be restored.',
            },
      );
    } finally {
      setSubmitting(false);
    }
  }

  function updateField(id: string, next: Partial<FieldRow>) {
    setDraft((current) => ({
      ...current,
      fields: current.fields.map((field) => (field.id === id ? { ...field, ...next } : field)),
    }));
  }

  return (
    <div className={classes.studio}>
      <header className={classes.header}>
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
          <Tooltip label="Back to Blocks">
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={leaveStudio}
              aria-label="Back to Blocks"
            >
              <IconArrowLeft size={18} />
            </ActionIcon>
          </Tooltip>
          <div className={classes.titleGroup}>
            <TextInput
              variant="unstyled"
              classNames={{ input: classes.nameInput }}
              value={draft.name}
              onChange={(event) => update({ name: event.currentTarget.value })}
              placeholder="Untitled Block"
              aria-label="Block name"
            />
            <Text size="xs" c="dimmed">
              {block?.externalReferenceCode ?? 'New custom Block'}
            </Text>
          </div>
          {block ? (
            <Badge variant="light" color={sourceState === 'NATIVE' ? 'blue' : 'grape'}>
              {sourceState === 'NATIVE' ? 'Native template' : 'Custom source'}
            </Badge>
          ) : (
            <Badge variant="light" color="gray">
              Custom Block
            </Badge>
          )}
        </Group>
        <Group gap="xs" wrap="nowrap">
          <Text size="sm" c={dirty ? 'orange' : 'teal'}>
            {dirty ? 'Unsaved changes' : 'Saved ✓'}
          </Text>
          {dirty ? (
            <Tooltip label="Discard unsaved changes">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={resetChanges}
                aria-label="Reset changes"
              >
                <IconRefresh size={17} />
              </ActionIcon>
            </Tooltip>
          ) : null}
          {nativeAvailable ? (
            <Button
              size="xs"
              variant="default"
              leftSection={<IconRestore size={15} />}
              loading={submitting}
              onClick={() => void restoreNative()}
            >
              Restore native
            </Button>
          ) : null}
          <Button
            size="xs"
            leftSection={<IconDeviceFloppy size={15} />}
            loading={submitting}
            onClick={() => void save()}
          >
            Save
          </Button>
        </Group>
      </header>

      {problem ? (
        <Alert
          className={classes.problem}
          color="red"
          icon={<IconAlertTriangle size={16} />}
          title={problem.title}
        >
          {problem.detail}
        </Alert>
      ) : null}

      <Tabs value={activeTab} onChange={setActiveTab} className={classes.tabs} keepMounted>
        <Tabs.List>
          <Tabs.Tab value="code" leftSection={<IconCode size={15} />}>
            Code
          </Tabs.Tab>
          <Tabs.Tab value="fields">
            Fields{' '}
            {missingFields.length > 0 ? (
              <Badge size="xs" color="orange" ml={5}>
                {missingFields.length}
              </Badge>
            ) : null}
          </Tabs.Tab>
          <Tabs.Tab value="schema">Schema</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="code" pt="md">
          <Grid gutter="md" align="stretch">
            <Grid.Col span={{ base: 12, xl: 7 }}>
              <Stack gap="md">
                <Paper withBorder radius="md" p="xs" className={classes.sourcePanel}>
                  <Group justify="space-between" px="xs" pb="xs">
                    <div>
                      <Text fw={650} size="sm">
                        HTML
                      </Text>
                      <Text size="xs" c="dimmed">
                        Active source used by this Block at render time
                      </Text>
                    </div>
                    <Text size="xs" c="dimmed">
                      {bindings.props.length} bindings detected
                    </Text>
                  </Group>
                  <CodeEditor
                    language="html"
                    value={draft.html ?? ''}
                    onChange={(html) => update({ html })}
                    onSave={() => void save()}
                    aria-label="Block HTML source"
                  />
                </Paper>
                <Paper withBorder radius="md" p="xs" className={classes.sourcePanel}>
                  <Group justify="space-between" px="xs" pb="xs">
                    <div>
                      <Text fw={650} size="sm">
                        JavaScript
                      </Text>
                      <Text size="xs" c="dimmed">
                        Runs in an isolated Block sandbox. Its visible Neriva.request calls use the
                        declared runtime API only.
                      </Text>
                    </div>
                    <Text size="xs" c="dimmed">
                      {draft.js?.split('\n').length ?? 0} lines
                    </Text>
                  </Group>
                  <CodeEditor
                    language="javascript"
                    value={draft.js ?? ''}
                    onChange={(js) => update({ js })}
                    onSave={() => void save()}
                    aria-label="Block JavaScript source"
                  />
                </Paper>
                <Paper withBorder radius="md" p="xs" className={classes.sourcePanel}>
                  <Group justify="space-between" px="xs" pb="xs">
                    <div>
                      <Text fw={650} size="sm">
                        CSS
                      </Text>
                      <Text size="xs" c="dimmed">
                        Scoped to this Block in the preview and published page
                      </Text>
                    </div>
                    <Text size="xs" c="dimmed">
                      {draft.css?.split('\n').length ?? 0} lines
                    </Text>
                  </Group>
                  <CodeEditor
                    language="css"
                    value={draft.css ?? ''}
                    onChange={(css) => update({ css })}
                    onSave={() => void save()}
                    aria-label="Block CSS source"
                  />
                </Paper>
                {sourceWarning ? (
                  <Alert color="yellow" variant="light">
                    {sourceWarning}
                  </Alert>
                ) : null}
                {draft.html === null || draft.html.trim() === '' ? (
                  <Alert color="blue" variant="light">
                    No template source has been authored yet. Add the real HTML for this Block here.
                    The Studio never invents source code for you.
                  </Alert>
                ) : null}
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, xl: 5 }}>
              <Box className={classes.previewSticky}>
                <BlockPreviewPanel
                  erc={block?.externalReferenceCode ?? '__new-block__'}
                  blockName={draft.name || 'Untitled Block'}
                  fields={schemaFields}
                  slotNames={slots}
                  html={draft.html}
                  css={draft.css}
                  js={draft.js}
                />
              </Box>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        <Tabs.Panel value="fields" pt="md">
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, lg: 8 }}>
              <Stack gap="md">
                <Paper withBorder radius="md" p="md">
                  <Group justify="space-between" mb="xs">
                    <div>
                      <Text fw={650}>Bindings detected in source</Text>
                      <Text size="xs" c="dimmed">
                        Fields are the data contract for these template references.
                      </Text>
                    </div>
                    <Badge variant="light">{detected.length} detected</Badge>
                  </Group>
                  {detected.length === 0 ? (
                    <Text size="sm" c="dimmed">
                      Add a binding such as <Code>{'{{title}}'}</Code> or{' '}
                      <Code>data-nv-text="title"</Code> to HTML, then return here to add its field.
                    </Text>
                  ) : (
                    <Stack gap="xs">
                      {detected.map((key) => (
                        <Group key={key} justify="space-between">
                          <Group gap="xs">
                            <Code>{key}</Code>
                            {schemaKeys.has(key) ? (
                              <Text size="xs" c="teal">
                                <IconCheck size={13} style={{ verticalAlign: -2 }} /> In schema
                              </Text>
                            ) : (
                              <Text size="xs" c="orange">
                                Missing from schema
                              </Text>
                            )}
                          </Group>
                          {!schemaKeys.has(key) && !draft.advancedSchema ? (
                            <Button
                              size="compact-xs"
                              variant="light"
                              leftSection={<IconPlus size={12} />}
                              onClick={() => addDetectedField(key)}
                            >
                              Add field
                            </Button>
                          ) : null}
                        </Group>
                      ))}
                    </Stack>
                  )}
                  {unusedFields.length > 0 ? (
                    <Alert color="yellow" variant="light" mt="md">
                      {unusedFields.map((field) => field.key).join(', ')}{' '}
                      {unusedFields.length === 1 ? 'is' : 'are'} defined in the schema but not used
                      by the current template.
                    </Alert>
                  ) : null}
                </Paper>

                {draft.advancedSchema ? (
                  <Alert color="blue" variant="light">
                    This schema uses JSON Schema features beyond the visual field editor. Edit it in
                    the Schema tab; detected bindings remain visible above.
                  </Alert>
                ) : (
                  <>
                    {draft.fields.map((field, index) => (
                      <Paper key={field.id} withBorder radius="md" p="md">
                        <Group justify="space-between" mb="sm">
                          <Text size="sm" fw={650}>
                            Field {index + 1}
                          </Text>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                fields: current.fields.filter(
                                  (candidate) => candidate.id !== field.id,
                                ),
                              }))
                            }
                            aria-label={`Remove ${field.key || 'field'}`}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                        <Grid gutter="sm">
                          <Grid.Col span={{ base: 12, sm: 4 }}>
                            <TextInput
                              label="Key"
                              value={field.key}
                              onChange={(event) =>
                                updateField(field.id, { key: event.currentTarget.value })
                              }
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 4 }}>
                            <TextInput
                              label="Label"
                              value={field.label}
                              onChange={(event) =>
                                updateField(field.id, { label: event.currentTarget.value })
                              }
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 4 }}>
                            <Select
                              label="Type"
                              data={FIELD_TYPE_OPTIONS}
                              value={field.type}
                              onChange={(type) =>
                                updateField(field.id, {
                                  type: (type ?? 'text') as FieldRow['type'],
                                })
                              }
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 8 }}>
                            <TextInput
                              label="Description"
                              value={field.description ?? ''}
                              onChange={(event) =>
                                updateField(field.id, { description: event.currentTarget.value })
                              }
                            />
                          </Grid.Col>
                          <Grid.Col span={{ base: 12, sm: 4 }}>
                            <TextInput
                              label="Default value"
                              value={
                                field.defaultValue === undefined ? '' : String(field.defaultValue)
                              }
                              onChange={(event) =>
                                updateField(field.id, { defaultValue: event.currentTarget.value })
                              }
                            />
                          </Grid.Col>
                        </Grid>
                        <Group justify="space-between" mt="sm">
                          <Switch
                            size="sm"
                            label="Required"
                            checked={field.required}
                            onChange={(event) =>
                              updateField(field.id, { required: event.currentTarget.checked })
                            }
                          />
                          {field.type === 'choice' ? (
                            <TextInput
                              size="xs"
                              label="Options, comma separated"
                              value={field.options.join(', ')}
                              onChange={(event) =>
                                updateField(field.id, {
                                  options: event.currentTarget.value
                                    .split(',')
                                    .map((item) => item.trim())
                                    .filter(Boolean),
                                })
                              }
                            />
                          ) : null}
                        </Group>
                      </Paper>
                    ))}
                    <Button
                      variant="light"
                      leftSection={<IconPlus size={16} />}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          fields: [...current.fields, createField()],
                        }))
                      }
                    >
                      Add field
                    </Button>
                  </>
                )}

                <Paper withBorder radius="md" p="md">
                  <Group justify="space-between" mb="sm">
                    <div>
                      <Text fw={650}>Slots</Text>
                      <Text size="xs" c="dimmed">
                        Named areas where page authors can nest other Blocks.
                      </Text>
                    </div>
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconPlus size={14} />}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          slots: [...current.slots, { name: '' }],
                        }))
                      }
                    >
                      Add slot
                    </Button>
                  </Group>
                  <Stack gap="xs">
                    {draft.slots.length === 0 ? (
                      <Text size="sm" c="dimmed">
                        This Block has no slots.
                      </Text>
                    ) : (
                      draft.slots.map((slot, index) => (
                        <Group key={`${slot.name}-${index}`}>
                          <TextInput
                            style={{ flex: 1 }}
                            placeholder="content"
                            value={slot.name}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                slots: current.slots.map((candidate, candidateIndex) =>
                                  candidateIndex === index
                                    ? { ...candidate, name: event.currentTarget.value }
                                    : candidate,
                                ),
                              }))
                            }
                          />
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                slots: current.slots.filter(
                                  (_slot, slotIndex) => slotIndex !== index,
                                ),
                              }))
                            }
                            aria-label="Remove slot"
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      ))
                    )}
                  </Stack>
                </Paper>
                <Paper withBorder radius="md" p="md">
                  <Text fw={650} mb="sm">
                    Block details
                  </Text>
                  <Grid gutter="sm">
                    <Grid.Col span={{ base: 12, sm: 6 }}>
                      <Select
                        label="Category"
                        searchable
                        clearable
                        data={CATEGORY_SUGGESTIONS}
                        value={draft.category || null}
                        onChange={(category) => update({ category: category ?? '' })}
                      />
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <Textarea
                        label="Description"
                        autosize
                        minRows={2}
                        value={draft.description}
                        onChange={(event) => update({ description: event.currentTarget.value })}
                      />
                    </Grid.Col>
                  </Grid>
                </Paper>
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, lg: 4 }}>
              <Box className={classes.previewSticky}>
                <BlockPreviewPanel
                  erc={block?.externalReferenceCode ?? '__new-block__'}
                  blockName={draft.name || 'Untitled Block'}
                  fields={schemaFields}
                  slotNames={slots}
                  html={draft.html}
                  css={draft.css}
                  js={draft.js}
                />
              </Box>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        <Tabs.Panel value="schema" pt="md">
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, lg: 7 }}>
              <Paper withBorder radius="md" p="md">
                <Group justify="space-between" mb="xs">
                  <div>
                    <Text fw={650}>JSON Schema</Text>
                    <Text size="xs" c="dimmed">
                      The persisted contract consumed by editors and API clients.
                    </Text>
                  </div>
                  {draft.advancedSchema ? (
                    <Badge color="orange" variant="light">
                      Advanced
                    </Badge>
                  ) : (
                    <Badge color="teal" variant="light">
                      Generated from Fields
                    </Badge>
                  )}
                </Group>
                <JsonInput
                  autosize
                  minRows={24}
                  value={
                    draft.advancedSchema
                      ? draft.schemaText
                      : JSON.stringify(fieldsToSchema(draft.fields), null, 2)
                  }
                  onChange={(schemaText) => update({ schemaText, advancedSchema: true })}
                  validationError="Schema must be valid JSON"
                  formatOnBlur
                />
                <Group mt="sm" justify="space-between">
                  <Text size="xs" c="dimmed">
                    Editing this JSON switches to advanced schema mode.
                  </Text>
                  {draft.advancedSchema ? (
                    <Button
                      size="xs"
                      variant="light"
                      onClick={() => {
                        let parsed: unknown;
                        try {
                          parsed = JSON.parse(draft.schemaText) as unknown;
                        } catch {
                          notifications.show({
                            color: 'red',
                            message: 'The schema is not valid JSON yet.',
                          });
                          return;
                        }
                        const fields = schemaToFields(parsed);
                        if (fields === null) {
                          notifications.show({
                            color: 'yellow',
                            message:
                              'This schema cannot be represented by the visual field editor.',
                          });
                          return;
                        }
                        setDraft((current) => ({
                          ...current,
                          fields: fields.map((field) => ({ ...field, id: randomId() })),
                          advancedSchema: false,
                        }));
                      }}
                    >
                      Use visual fields
                    </Button>
                  ) : null}
                </Group>
              </Paper>
            </Grid.Col>
            <Grid.Col span={{ base: 12, lg: 5 }}>
              <Box className={classes.previewSticky}>
                <BlockPreviewPanel
                  erc={block?.externalReferenceCode ?? '__new-block__'}
                  blockName={draft.name || 'Untitled Block'}
                  fields={schemaFields}
                  slotNames={slots}
                  html={draft.html}
                  css={draft.css}
                  js={draft.js}
                />
              </Box>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
