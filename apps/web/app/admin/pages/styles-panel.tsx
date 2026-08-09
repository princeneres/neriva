'use client';

import {
  ActionIcon,
  Box,
  ColorInput,
  ColorSwatch,
  Group,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { useState } from 'react';

// The Styles tab of the block inspector (spec 12 section 4): edits the
// node's per-instance styles against the whitelist from section 3. Values
// are raw CSS strings or token:<name>; clearing a control removes the key so
// the block and style book defaults apply again.

const CUSTOM_OPTION = '__custom__';

export interface StylesPanelProps {
  styles: Record<string, string>;
  // Published style book tokens (name -> CSS value); empty when none exists.
  tokens: Record<string, string>;
  onSetStyle: (name: string, value: string | undefined) => void;
}

export function StylesPanel({ styles, tokens, onSetStyle }: StylesPanelProps) {
  return (
    <Stack gap="md">
      <Section label="Spacing">
        <BoxModelGrid prefix="margin" label="Margin" styles={styles} onSetStyle={onSetStyle} />
        <BoxModelGrid prefix="padding" label="Padding" styles={styles} onSetStyle={onSetStyle} />
      </Section>

      <Section label="Colors">
        <ColorStyleControl
          label="Background"
          value={styles.background}
          tokens={tokens}
          onChange={(value) => onSetStyle('background', value)}
        />
        <ColorStyleControl
          label="Text color"
          value={styles.textColor}
          tokens={tokens}
          onChange={(value) => onSetStyle('textColor', value)}
        />
      </Section>

      <Section label="Text">
        <CssValueInput
          label="Font size"
          placeholder="e.g. 1.25rem"
          value={styles.fontSize}
          onChange={(value) => onSetStyle('fontSize', value)}
        />
        <Box>
          <Group justify="space-between" wrap="nowrap" mb={2}>
            <Text size="xs" fw={500}>
              Alignment
            </Text>
            {styles.textAlign !== undefined ? (
              <ClearButton
                label="Clear alignment"
                onClick={() => onSetStyle('textAlign', undefined)}
              />
            ) : null}
          </Group>
          <SegmentedControl
            size="xs"
            fullWidth
            value={styles.textAlign ?? ''}
            onChange={(value) => onSetStyle('textAlign', value)}
            data={[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Center' },
              { value: 'right', label: 'Right' },
              { value: 'justify', label: 'Justify' },
            ]}
          />
        </Box>
      </Section>

      <Section label="Border">
        <Group grow gap="xs">
          <CssValueInput
            label="Width"
            placeholder="e.g. 1px"
            value={styles.borderWidth}
            onChange={(value) => onSetStyle('borderWidth', value)}
          />
          <CssValueInput
            label="Radius"
            placeholder="e.g. 8px"
            value={styles.borderRadius}
            onChange={(value) => onSetStyle('borderRadius', value)}
          />
        </Group>
        <ColorInput
          label="Border color"
          size="xs"
          placeholder="from style book"
          value={styles.borderColor ?? ''}
          onChange={(value) => onSetStyle('borderColor', value === '' ? undefined : value)}
        />
      </Section>

      <Section label="Size and position">
        <Group grow gap="xs">
          <CssValueInput
            label="Max width"
            placeholder="e.g. 960px"
            value={styles.maxWidth}
            onChange={(value) => onSetStyle('maxWidth', value)}
          />
          <CssValueInput
            label="Min height"
            placeholder="e.g. 200px"
            value={styles.minHeight}
            onChange={(value) => onSetStyle('minHeight', value)}
          />
        </Group>
        <Select
          label="Align self"
          description="How the block aligns inside a row or column layout."
          size="xs"
          placeholder="default"
          clearable
          data={['auto', 'flex-start', 'center', 'flex-end', 'stretch']}
          value={styles.alignSelf ?? null}
          onChange={(value) => onSetStyle('alignSelf', value ?? undefined)}
        />
      </Section>
    </Stack>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Text size="xs" fw={700} tt="uppercase" c="slate.5" lts="0.05em" mb={6}>
        {label}
      </Text>
      <Stack gap="xs">{children}</Stack>
    </Box>
  );
}

function ClearButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tooltip label={label}>
      <ActionIcon variant="subtle" color="slate" size="xs" aria-label={label} onClick={onClick}>
        <IconX size={12} />
      </ActionIcon>
    </Tooltip>
  );
}

// Free-form CSS value input; emptying it removes the style key.
function CssValueInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <TextInput
      label={label}
      size="xs"
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(event) => {
        const next = event.currentTarget.value;
        onChange(next === '' ? undefined : next);
      }}
    />
  );
}

const BOX_SIDES = ['Top', 'Right', 'Bottom', 'Left'] as const;

// Compact box-model grid: four inputs (top/right/bottom/left) per group.
function BoxModelGrid({
  prefix,
  label,
  styles,
  onSetStyle,
}: {
  prefix: 'margin' | 'padding';
  label: string;
  styles: Record<string, string>;
  onSetStyle: (name: string, value: string | undefined) => void;
}) {
  return (
    <Box>
      <Text size="xs" fw={500} mb={2}>
        {label}
      </Text>
      <SimpleGrid cols={4} spacing={4}>
        {BOX_SIDES.map((side) => {
          const key = `${prefix}${side}`;
          return (
            <TextInput
              key={key}
              size="xs"
              placeholder="-"
              aria-label={`${label} ${side.toLowerCase()}`}
              value={styles[key] ?? ''}
              onChange={(event) => {
                const next = event.currentTarget.value;
                onSetStyle(key, next === '' ? undefined : next);
              }}
            />
          );
        })}
      </SimpleGrid>
      <Group gap={0} justify="space-between" px={2}>
        {BOX_SIDES.map((side) => (
          <Text key={side} fz={10} c="slate.4" style={{ width: '25%', textAlign: 'center' }}>
            {side}
          </Text>
        ))}
      </Group>
    </Box>
  );
}

// token:<name> when the value references a style book token, null otherwise.
function tokenNameOf(value: string | undefined): string | null {
  if (value !== undefined && value.startsWith('token:')) {
    return value.slice('token:'.length);
  }
  return null;
}

// Color control offering the published style book's color tokens first
// (swatch options storing token:<name>), plus a custom CSS value.
function ColorStyleControl({
  label,
  value,
  tokens,
  onChange,
}: {
  label: string;
  value: string | undefined;
  tokens: Record<string, string>;
  onChange: (value: string | undefined) => void;
}) {
  const colorTokens = Object.entries(tokens).filter(([name]) => name.startsWith('color'));
  const tokenName = tokenNameOf(value);
  const isCustomValue = value !== undefined && tokenName === null;
  // Sticky while the user has picked "Custom..." but not typed a value yet.
  const [customMode, setCustomMode] = useState(isCustomValue);
  const showCustomInput = customMode || isCustomValue;

  const options = [
    ...colorTokens.map(([name]) => ({ value: `token:${name}`, label: name })),
    { value: CUSTOM_OPTION, label: 'Custom...' },
  ];
  const selectValue =
    tokenName !== null ? `token:${tokenName}` : showCustomInput ? CUSTOM_OPTION : null;
  const selectedSwatch = tokenName !== null ? tokens[tokenName] : undefined;

  return (
    <Box>
      <Select
        label={label}
        size="xs"
        placeholder="from style book"
        clearable
        data={options}
        value={selectValue}
        leftSection={
          selectedSwatch !== undefined ? (
            <ColorSwatch color={selectedSwatch} size={14} />
          ) : undefined
        }
        renderOption={({ option }) => {
          const name = tokenNameOf(option.value);
          const swatch = name !== null ? tokens[name] : undefined;
          return (
            <Group gap={8} wrap="nowrap">
              {swatch !== undefined ? <ColorSwatch color={swatch} size={14} /> : null}
              <Text size="xs">{option.label}</Text>
            </Group>
          );
        }}
        onChange={(next) => {
          if (next === null) {
            setCustomMode(false);
            onChange(undefined);
            return;
          }
          if (next === CUSTOM_OPTION) {
            setCustomMode(true);
            if (tokenName !== null) {
              onChange(undefined);
            }
            return;
          }
          setCustomMode(false);
          onChange(next);
        }}
      />
      {showCustomInput ? (
        <ColorInput
          size="xs"
          mt={4}
          placeholder="#cc3d47"
          aria-label={`${label} custom value`}
          value={isCustomValue ? value : ''}
          onChange={(next) => onChange(next === '' ? undefined : next)}
        />
      ) : null}
    </Box>
  );
}
