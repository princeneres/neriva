'use client';

import { JsonInput, NumberInput, Select, Switch, Textarea, TextInput } from '@mantine/core';
import { useState } from 'react';
import type { PropFieldSpec } from './schema-form';

// One form input per block prop, mapped from the field spec. Every change is
// pushed upward immediately so the canvas re-renders per keystroke.
export function PropField({
  spec,
  value,
  onChange,
}: {
  spec: PropFieldSpec;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const common = {
    label: spec.label,
    description: spec.description ?? undefined,
    required: spec.required,
    size: 'sm' as const,
  };
  switch (spec.kind) {
    case 'text':
      return (
        <TextInput
          {...common}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => {
            const next = event.currentTarget.value;
            onChange(next === '' ? undefined : next);
          }}
        />
      );
    case 'textarea':
      return (
        <Textarea
          {...common}
          autosize
          minRows={3}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => {
            const next = event.currentTarget.value;
            onChange(next === '' ? undefined : next);
          }}
        />
      );
    case 'number':
      return (
        <NumberInput
          {...common}
          value={typeof value === 'number' ? value : ''}
          onChange={(next) => onChange(typeof next === 'number' ? next : undefined)}
        />
      );
    case 'boolean':
      return (
        <Switch
          label={spec.label}
          description={spec.description ?? undefined}
          size="sm"
          checked={value === true}
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
      );
    case 'enum':
      return (
        <Select
          {...common}
          data={spec.enumValues.map(String)}
          value={value === undefined || value === null ? null : String(value)}
          clearable={!spec.required}
          onChange={(next) => {
            if (next === null) {
              onChange(undefined);
              return;
            }
            onChange(spec.enumValues.find((candidate) => String(candidate) === next));
          }}
        />
      );
    default:
      return (
        <JsonValueField
          label={spec.label}
          description={
            spec.description ??
            'This field has a shape the visual editor cannot render, so it is edited as JSON.'
          }
          required={spec.required}
          value={value}
          onChange={onChange}
        />
      );
  }
}

// JSON escape hatch for a single value: keeps its own text while the user
// types and only pushes parsed values upward.
export function JsonValueField({
  label,
  description,
  required,
  value,
  onChange,
}: {
  label: string;
  description: string;
  required?: boolean;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const [text, setText] = useState(() =>
    value === undefined ? '' : JSON.stringify(value, null, 2),
  );
  const [invalid, setInvalid] = useState(false);

  return (
    <JsonInput
      label={label}
      description={description}
      required={required}
      size="sm"
      autosize
      minRows={3}
      maxRows={12}
      value={text}
      styles={{ input: { fontFamily: 'var(--font-mono), monospace' } }}
      error={invalid ? 'Not valid JSON yet. The value updates once it parses.' : undefined}
      onChange={(next) => {
        setText(next);
        if (next.trim() === '') {
          setInvalid(false);
          onChange(undefined);
          return;
        }
        try {
          onChange(JSON.parse(next));
          setInvalid(false);
        } catch {
          setInvalid(true);
        }
      }}
    />
  );
}
