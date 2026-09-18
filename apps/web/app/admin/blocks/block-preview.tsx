'use client';

import {
  Alert,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { IconAdjustments, IconInfoCircle, IconRestore } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { type BlockInfo, type RenderNode, RenderTree } from '../../../lib/renderer/render-tree';
import { useSite } from '../../../lib/site-context';
import { useSitePreviewData } from '../pages/use-site-preview-data';
import type { BuilderField } from './types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function schemaTextToPreviewFields(schemaText: string): BuilderField[] | null {
  try {
    return schemaToPreviewFields(JSON.parse(schemaText) as unknown);
  } catch {
    return null;
  }
}

export function schemaToPreviewFields(schema: unknown): BuilderField[] | null {
  if (!isPlainObject(schema) || !isPlainObject(schema.properties)) return null;
  const required = Array.isArray(schema.required)
    ? schema.required.filter((key): key is string => typeof key === 'string')
    : [];
  const fields: BuilderField[] = [];
  for (const [key, definition] of Object.entries(schema.properties)) {
    if (!isPlainObject(definition)) continue;
    const label = typeof definition.title === 'string' ? definition.title : key;
    const description = typeof definition.description === 'string' ? definition.description : '';
    const defaultValue =
      typeof definition.default === 'string' ||
      typeof definition.default === 'number' ||
      typeof definition.default === 'boolean'
        ? definition.default
        : undefined;
    if (Array.isArray(definition.enum)) {
      const options = definition.enum.filter((value): value is string => typeof value === 'string');
      if (options.length > 0) {
        fields.push({
          key,
          label,
          description,
          defaultValue,
          type: 'choice',
          options,
          required: required.includes(key),
        });
      }
      continue;
    }
    if (definition.type === 'string') {
      fields.push({
        key,
        label,
        description,
        defaultValue,
        type: definition.format === 'multiline' ? 'longtext' : 'text',
        options: [],
        required: required.includes(key),
      });
    } else if (definition.type === 'number' || definition.type === 'integer') {
      fields.push({
        key,
        label,
        description,
        defaultValue,
        type: 'number',
        options: [],
        required: required.includes(key),
      });
    } else if (definition.type === 'boolean') {
      fields.push({
        key,
        label,
        description,
        defaultValue,
        type: 'boolean',
        options: [],
        required: required.includes(key),
      });
    }
  }
  return fields;
}

function FieldValueInput({
  field,
  value,
  onChange,
}: {
  field: BuilderField;
  value: unknown;
  onChange: (value: unknown | undefined) => void;
}) {
  const label = field.label || field.key;
  if (field.type === 'boolean')
    return (
      <Switch
        size="xs"
        label={label}
        checked={value === true}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    );
  if (field.type === 'number')
    return (
      <NumberInput
        size="xs"
        label={label}
        value={typeof value === 'number' ? value : ''}
        onChange={(next) => onChange(typeof next === 'number' ? next : undefined)}
      />
    );
  if (field.type === 'choice')
    return (
      <Select
        size="xs"
        label={label}
        data={field.options}
        clearable
        value={typeof value === 'string' ? value : null}
        onChange={(next) => onChange(next ?? undefined)}
      />
    );
  if (field.type === 'longtext')
    return (
      <Textarea
        size="xs"
        autosize
        minRows={2}
        label={label}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    );
  return (
    <TextInput
      size="xs"
      label={label}
      value={typeof value === 'string' ? value : ''}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
}

const SLOT_ERC = '__block-studio-slot__';
const SLOT_INFO: BlockInfo = {
  name: 'Slot placeholder',
  html: '<div class="nv-studio-slot">Drop child blocks in {{name}}</div>',
  css: '.nv-studio-slot { display: grid; min-height: 4.5rem; place-items: center; border: 1px dashed #9a968f; color: #6e6962; font: 600 0.75rem system-ui; }',
};

// The preview constructs an in-memory Block and sends it through RenderTree,
// the same renderer used by the public route.
export function BlockPreviewPanel({
  erc,
  blockName,
  fields,
  slotNames,
  html,
  css,
  js,
}: {
  erc: string;
  blockName: string;
  fields: BuilderField[] | null;
  slotNames: string[];
  html: string | null;
  css: string | null;
  js: string | null;
}) {
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});
  const [testDataOpen, setTestDataOpen] = useState(false);
  const { current: site } = useSite();
  const { css: siteCss, sitePages } = useSitePreviewData(site?.slug ?? null);
  const previewFields = useMemo(() => {
    const seen = new Set<string>();
    return (fields ?? []).filter((field) => {
      const key = field.key.trim();
      if (key === '' || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [fields]);
  const props = useMemo(() => {
    const next: Record<string, unknown> = {};
    for (const field of previewFields) {
      if (field.defaultValue !== undefined) next[field.key] = field.defaultValue;
      if (field.key in overrides) next[field.key] = overrides[field.key];
    }
    return next;
  }, [overrides, previewFields]);

  function updateOverride(key: string, value: unknown | undefined) {
    setOverrides((current) => {
      if (value === undefined) {
        const { [key]: _removed, ...rest } = current;
        return rest;
      }
      return { ...current, [key]: value };
    });
  }
  const slots = useMemo<Record<string, RenderNode[]>>(() => {
    const next: Record<string, RenderNode[]> = {};
    for (const name of slotNames) next[name] = [{ block: SLOT_ERC, props: { name } }];
    return next;
  }, [slotNames]);
  const info: Record<string, BlockInfo> = {
    [erc]: { name: blockName, html, css, js, slots: slotNames },
    [SLOT_ERC]: SLOT_INFO,
  };

  return (
    <>
      <Card padding={0} withBorder radius="md" style={{ overflow: 'hidden' }}>
        <Group
          justify="space-between"
          px="md"
          py="sm"
          style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
        >
          <div>
            <Title order={3} fz="sm">
              Live preview
            </Title>
            <Text size="xs" c="dimmed">
              Same renderer used by the published site
            </Text>
          </div>
          <Group gap={4}>
            <Text size="xs" c="dimmed">
              Source defaults
            </Text>
            <Button
              size="compact-xs"
              variant="subtle"
              color="gray"
              leftSection={<IconAdjustments size={14} />}
              onClick={() => setTestDataOpen(true)}
            >
              Test data
            </Button>
          </Group>
        </Group>
        <div
          className="nv-site-root"
          data-nv-theme="light"
          style={{ minHeight: 180, background: '#fff' }}
          onClickCapture={(event) => event.preventDefault()}
        >
          {siteCss !== '' ? <style>{siteCss}</style> : null}
          <RenderTree
            tree={{ blocks: [{ block: erc, props, slots }] }}
            blockInfo={info}
            sitePages={sitePages}
            siteSlug={site?.slug}
            siteBasePath={site?.slug ? `/s/${encodeURIComponent(site.slug)}` : undefined}
          />
        </div>
        {html === null ? (
          <Alert icon={<IconInfoCircle size={16} />} color="yellow" variant="light" m="md">
            <Text size="xs">
              This legacy runtime Block has no authorable template yet. Its preview still uses the
              production renderer, but it has no editable source to show.
            </Text>
          </Alert>
        ) : null}
      </Card>
      <Modal
        opened={testDataOpen}
        onClose={() => setTestDataOpen(false)}
        title="Temporary preview data"
        centered
      >
        <Stack gap="md">
          <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
            These values are only passed to this preview. They do not change the HTML, CSS,
            JavaScript, schema, or any Block instance on a page.
          </Alert>
          {previewFields.length === 0 ? (
            <Text size="sm" c="dimmed">
              This Block has no declared fields to test.
            </Text>
          ) : (
            <Stack gap="xs">
              {previewFields.map((field) => (
                <FieldValueInput
                  key={field.key}
                  field={field}
                  value={props[field.key]}
                  onChange={(value) => updateOverride(field.key, value)}
                />
              ))}
            </Stack>
          )}
          <Group justify="flex-end">
            <Button
              size="xs"
              variant="default"
              leftSection={<IconRestore size={14} />}
              disabled={Object.keys(overrides).length === 0}
              onClick={() => setOverrides({})}
            >
              Reset test data
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
