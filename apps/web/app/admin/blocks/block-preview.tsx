'use client';

import {
  Card,
  Divider,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { type ReactNode, useMemo, useState } from 'react';
import { HelpTip } from '../../../components/help-tip';
import { rendererFor } from '../../../lib/renderer/registry';
import type { BuilderField } from './types';

const LOREM_SENTENCE =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';

// Neutral inline SVG so image-ish props show a picture instead of a broken img.
const SAMPLE_IMAGE = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">' +
    '<rect width="640" height="360" fill="#e6e3dd"/>' +
    '<path d="M0 302 L170 182 L330 302 L450 226 L640 330 V360 H0 Z" fill="#d4d0c8"/>' +
    '<circle cx="500" cy="96" r="38" fill="#d4d0c8"/>' +
    '</svg>',
)}`;

const IMAGE_KEY_PATTERN = /(image|img|photo|picture|avatar|logo|cover|thumbnail)/i;
const URL_KEY_PATTERN = /(url|href|link|src)/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Lenient counterpart of schemaToFields, used only to drive the preview:
// derives a sample field per property it understands and skips the rest.
// Returns null when nothing can be derived, which hides the preview.
export function schemaTextToPreviewFields(schemaText: string): BuilderField[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(schemaText) as unknown;
  } catch {
    return null;
  }
  if (!isPlainObject(parsed)) {
    return null;
  }
  const properties = parsed.properties;
  if (!isPlainObject(properties)) {
    return null;
  }
  const fields: BuilderField[] = [];
  for (const [key, raw] of Object.entries(properties)) {
    if (!isPlainObject(raw)) {
      continue;
    }
    const label = typeof raw.title === 'string' ? raw.title : '';
    if (Array.isArray(raw.enum)) {
      const options = raw.enum.filter((option): option is string => typeof option === 'string');
      if (options.length > 0) {
        fields.push({ key, label, type: 'choice', options, required: false });
      }
      continue;
    }
    if (raw.type === 'string') {
      const type = raw.format === 'multiline' ? 'longtext' : 'text';
      fields.push({ key, label, type, options: [], required: false });
    } else if (raw.type === 'number' || raw.type === 'integer') {
      fields.push({ key, label, type: 'number', options: [], required: false });
    } else if (raw.type === 'boolean') {
      fields.push({ key, label, type: 'boolean', options: [], required: false });
    }
  }
  if (fields.length === 0 && Object.keys(properties).length > 0) {
    return null;
  }
  return fields;
}

function defaultTextSample(field: BuilderField, erc: string): string {
  if (IMAGE_KEY_PATTERN.test(field.key) || (erc === 'image' && /^(url|src)$/i.test(field.key))) {
    return SAMPLE_IMAGE;
  }
  if (URL_KEY_PATTERN.test(field.key)) {
    return '#';
  }
  return field.label.trim() || field.key;
}

function defaultSample(field: BuilderField, erc: string): unknown {
  switch (field.type) {
    case 'text':
      return defaultTextSample(field, erc);
    case 'longtext':
      return LOREM_SENTENCE;
    case 'number':
      return 42;
    case 'boolean':
      return true;
    case 'choice':
      return field.options[0] ?? '';
  }
}

// An override only applies while it still matches the field's current type;
// changing a field's type in the builder falls back to the generated default.
function effectiveSample(field: BuilderField, override: unknown, erc: string): unknown {
  switch (field.type) {
    case 'text':
    case 'longtext':
      return typeof override === 'string' ? override : defaultSample(field, erc);
    case 'number':
      return typeof override === 'number' ? override : defaultSample(field, erc);
    case 'boolean':
      return typeof override === 'boolean' ? override : defaultSample(field, erc);
    case 'choice':
      return typeof override === 'string' && field.options.includes(override)
        ? override
        : defaultSample(field, erc);
  }
}

function SlotPlaceholder({ name }: { name: string }) {
  return (
    <div
      style={{
        border: '2px dashed var(--mantine-color-slate-3)',
        borderRadius: 8,
        minHeight: 72,
        margin: '0.75rem',
        padding: '0.5rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--mantine-color-slate-5)',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      Slot: {name}
    </div>
  );
}

function SampleInput({
  field,
  value,
  onChange,
}: {
  field: BuilderField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const label = field.label.trim() || field.key;
  switch (field.type) {
    case 'text': {
      // The generated sample image is a long data URI; keep it out of the input.
      const isSampleImage = value === SAMPLE_IMAGE;
      return (
        <TextInput
          size="xs"
          label={label}
          placeholder={isSampleImage ? 'Sample image (type a URL to replace it)' : undefined}
          value={typeof value === 'string' && !isSampleImage ? value : ''}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      );
    }
    case 'longtext':
      return (
        <Textarea
          size="xs"
          label={label}
          autosize
          minRows={2}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      );
    case 'number':
      return (
        <NumberInput
          size="xs"
          label={label}
          value={typeof value === 'number' ? value : ''}
          onChange={(next) => onChange(typeof next === 'number' ? next : 0)}
        />
      );
    case 'boolean':
      return (
        <Switch
          size="xs"
          label={label}
          checked={value === true}
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
      );
    case 'choice':
      return (
        <Select
          size="xs"
          label={label}
          data={field.options}
          allowDeselect={false}
          value={typeof value === 'string' ? value : null}
          onChange={(next) => onChange(next ?? field.options[0] ?? '')}
        />
      );
  }
}

// Live preview of the block being edited. The block goes through the shared
// renderer registry (rendererFor), which is exactly what RenderTree does per
// node; RenderTree itself is not called because its slot plumbing only accepts
// nested RenderNode trees, while the preview injects styled placeholder divs
// as the already-rendered slot children (the same shape renderers receive).
export function BlockPreviewPanel({
  erc,
  blockName,
  fields,
  slotNames,
}: {
  erc: string;
  blockName: string;
  fields: BuilderField[] | null;
  slotNames: string[];
}) {
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});

  // First occurrence wins while the builder briefly holds duplicate keys.
  const sampleFields = useMemo(() => {
    if (fields === null) {
      return [];
    }
    const seen = new Set<string>();
    const result: BuilderField[] = [];
    for (const field of fields) {
      const key = field.key.trim();
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push({ ...field, key });
    }
    return result;
  }, [fields]);

  const sampleProps = useMemo(() => {
    const props: Record<string, unknown> = {};
    for (const field of sampleFields) {
      props[field.key] = effectiveSample(field, overrides[field.key], erc);
    }
    return props;
  }, [sampleFields, overrides, erc]);

  const Renderer = rendererFor(erc);
  const slots: Record<string, ReactNode> = {};
  for (const name of slotNames) {
    slots[name] = <SlotPlaceholder key={name} name={name} />;
  }

  const empty = sampleFields.length === 0 && slotNames.length === 0;

  return (
    <Card padding="xl" bg="white" withBorder>
      <Group gap={2} mb="md">
        <Title order={3} fz="h4">
          Preview
        </Title>
        <HelpTip label="How this block will look on a page, using the sample values below" />
      </Group>

      {fields === null ? (
        <Text size="sm" c="slate.4">
          Preview unavailable for this schema.
        </Text>
      ) : empty ? (
        <Text size="sm" c="slate.4">
          Add fields or slots to see how this block will look.
        </Text>
      ) : (
        <>
          {/* Links inside renderers are real anchors; keep clicks in the preview. */}
          <div
            onClickCapture={(event) => event.preventDefault()}
            style={{
              border: '1px solid var(--mantine-color-slate-2)',
              borderRadius: 8,
              overflow: 'hidden',
              background: '#fff',
            }}
          >
            <Renderer props={sampleProps} slots={slots} blockName={blockName} />
          </div>

          {sampleFields.length > 0 ? (
            <>
              <Divider my="md" label="Sample values" labelPosition="left" />
              <Stack gap="xs">
                {sampleFields.map((field) => (
                  <SampleInput
                    key={field.key}
                    field={field}
                    value={effectiveSample(field, overrides[field.key], erc)}
                    onChange={(value) =>
                      setOverrides((current) => ({ ...current, [field.key]: value }))
                    }
                  />
                ))}
              </Stack>
            </>
          ) : null}
        </>
      )}
    </Card>
  );
}
