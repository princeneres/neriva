'use client';

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Collapse,
  Group,
  JsonInput,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconChevronRight,
  IconCube,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useState } from 'react';
import { HelpTip } from '../../../components/help-tip';
import { BlockPickerModal } from './block-picker';
import {
  type EditorNode,
  type InsertLocation,
  insertNode,
  moveNode,
  removeNode,
  setNodeProp,
  setNodeProps,
} from './editor-state';
import { fieldSpecsFor, type PropFieldSpec, summarizeProps } from './schema-form';
import type { Block } from './types';

const SLOT_HELP = 'A slot is a space inside a block where other blocks can be placed.';

// The visual page builder: a vertical list of block cards, recursive through
// slots. All tree changes flow through the pure helpers in editor-state.ts
// and are reported upward via onNodesChange.
export function BlockCanvas({
  nodes,
  onNodesChange,
  blocks,
  blocksByErc,
  blocksLoading,
}: {
  nodes: EditorNode[];
  onNodesChange: (nodes: EditorNode[]) => void;
  blocks: Block[];
  blocksByErc: Map<string, Block>;
  blocksLoading: boolean;
}) {
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(new Set());
  const [pickerLocation, setPickerLocation] = useState<InsertLocation | 'closed'>('closed');

  function toggleExpanded(key: string) {
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handlePick(block: Block) {
    if (pickerLocation === 'closed') {
      return;
    }
    const result = insertNode(nodes, pickerLocation, block.externalReferenceCode);
    onNodesChange(result.nodes);
    setExpandedKeys((current) => new Set(current).add(result.key));
    setPickerLocation('closed');
  }

  function handleRemove(node: EditorNode) {
    const name = blocksByErc.get(node.block)?.name ?? node.block;
    modals.openConfirmModal({
      title: 'Remove block',
      children: (
        <Text size="sm">
          Remove &quot;{name}&quot; from this page? Blocks placed inside it are removed too. This
          only changes the draft; nothing happens until you save.
        </Text>
      ),
      labels: { confirm: 'Remove', cancel: 'Keep it' },
      confirmProps: { color: 'red' },
      onConfirm: () => onNodesChange(removeNode(nodes, node.key)),
    });
  }

  const shared: SharedCardProps = {
    blocksByErc,
    blocksLoading,
    expandedKeys,
    onToggle: toggleExpanded,
    onMove: (key, direction) => onNodesChange(moveNode(nodes, key, direction)),
    onRemove: handleRemove,
    onSetProp: (key, name, value) => onNodesChange(setNodeProp(nodes, key, name, value)),
    onSetProps: (key, props) => onNodesChange(setNodeProps(nodes, key, props)),
    onOpenPicker: setPickerLocation,
  };

  return (
    <>
      <Stack gap="sm">
        {nodes.length === 0 ? (
          <Card padding="xl">
            <Stack align="center" gap="sm" py="md">
              <ThemeIcon size={44} radius="xl" variant="light">
                <IconCube size={22} stroke={1.6} />
              </ThemeIcon>
              <Text fw={600}>This page is empty</Text>
              <Text size="sm" c="slate.5" ta="center" maw={400}>
                Pages are built by stacking blocks from top to bottom. Add your first block to start
                building.
              </Text>
            </Stack>
          </Card>
        ) : (
          nodes.map((node, index) => (
            <BlockCard key={node.key} node={node} index={index} count={nodes.length} {...shared} />
          ))
        )}
        <Group justify="center">
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={() => setPickerLocation(null)}
          >
            Add block
          </Button>
        </Group>
      </Stack>
      <BlockPickerModal
        opened={pickerLocation !== 'closed'}
        onClose={() => setPickerLocation('closed')}
        blocks={blocks}
        loading={blocksLoading}
        onPick={handlePick}
      />
    </>
  );
}

interface SharedCardProps {
  blocksByErc: Map<string, Block>;
  blocksLoading: boolean;
  expandedKeys: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onMove: (key: string, direction: 'up' | 'down') => void;
  onRemove: (node: EditorNode) => void;
  onSetProp: (key: string, name: string, value: unknown) => void;
  onSetProps: (key: string, props: Record<string, unknown>) => void;
  onOpenPicker: (location: InsertLocation) => void;
}

function BlockCard({
  node,
  index,
  count,
  ...shared
}: SharedCardProps & {
  node: EditorNode;
  index: number;
  count: number;
}) {
  const { blocksByErc, blocksLoading, expandedKeys, onToggle, onMove, onRemove } = shared;
  const block = blocksByErc.get(node.block);
  const expanded = expandedKeys.has(node.key);
  const summary = summarizeProps(node.props);
  const specs = block ? fieldSpecsFor(block.propsSchema) : [];
  const declaredSlots = block?.slots ?? [];
  const extraSlotNames = Object.keys(node.slots).filter(
    (name) => !declaredSlots.some((slot) => slot.name === name),
  );

  return (
    <Card padding="sm">
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Group gap="xs" wrap="nowrap" miw={0} style={{ flex: 1 }}>
          <ActionIcon
            variant="subtle"
            color="slate"
            onClick={() => onToggle(node.key)}
            aria-label={expanded ? 'Collapse block' : 'Expand block'}
          >
            {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          </ActionIcon>
          <Box miw={0}>
            <Group gap={6} wrap="nowrap">
              <Text fw={600} size="sm" truncate>
                {block ? block.name : node.block}
              </Text>
              {!block && !blocksLoading ? (
                <Tooltip label="No block with this reference exists anymore. Saving will fail until it is removed or the block is recreated.">
                  <Badge color="yellow">missing block</Badge>
                </Tooltip>
              ) : null}
            </Group>
            {!expanded && summary !== '' ? (
              <Text size="xs" c="slate.5" truncate>
                {summary}
              </Text>
            ) : null}
          </Box>
        </Group>
        <Group gap={4} wrap="nowrap">
          <Tooltip label="Move up">
            <ActionIcon
              variant="subtle"
              color="slate"
              disabled={index === 0}
              onClick={() => onMove(node.key, 'up')}
              aria-label="Move block up"
            >
              <IconArrowUp size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Move down">
            <ActionIcon
              variant="subtle"
              color="slate"
              disabled={index === count - 1}
              onClick={() => onMove(node.key, 'down')}
              aria-label="Move block down"
            >
              <IconArrowDown size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Remove">
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={() => onRemove(node)}
              aria-label="Remove block"
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <Collapse in={expanded}>
        <Box pl={38} pt="sm">
          <Stack gap="sm">
            {block && specs.length === 0 ? (
              <Text size="sm" c="slate.5">
                This block has nothing to fill in.
              </Text>
            ) : null}
            {specs.map((spec) => (
              <PropField
                key={`${node.key}:${spec.name}`}
                spec={spec}
                value={node.props[spec.name]}
                onChange={(value) => shared.onSetProp(node.key, spec.name, value)}
              />
            ))}
            {!block ? (
              <JsonValueField
                key={`${node.key}:props`}
                label="Props (JSON)"
                description="The block definition is unknown, so its values can only be edited as JSON."
                value={node.props}
                onChange={(value) =>
                  shared.onSetProps(
                    node.key,
                    // Only objects are valid props; anything else clears them.
                    typeof value === 'object' && value !== null && !Array.isArray(value)
                      ? (value as Record<string, unknown>)
                      : {},
                  )
                }
              />
            ) : null}
            {declaredSlots.map((slot) => (
              <SlotArea key={slot.name} parent={node} slotName={slot.name} declared {...shared} />
            ))}
            {extraSlotNames.map((name) => (
              <SlotArea key={name} parent={node} slotName={name} declared={false} {...shared} />
            ))}
          </Stack>
        </Box>
      </Collapse>
    </Card>
  );
}

function SlotArea({
  parent,
  slotName,
  declared,
  ...shared
}: SharedCardProps & {
  parent: EditorNode;
  slotName: string;
  declared: boolean;
}) {
  const children = parent.slots[slotName] ?? [];
  return (
    <Box
      p="sm"
      style={{
        border: '1px dashed var(--mantine-color-slate-3)',
        borderRadius: 'var(--mantine-radius-md)',
        background: 'var(--mantine-color-slate-0)',
      }}
    >
      <Group gap={4} mb={children.length > 0 ? 'sm' : 4}>
        <Text size="xs" fw={700} tt="uppercase" c="slate.5" lts="0.05em">
          {slotName}
        </Text>
        <HelpTip label={SLOT_HELP} />
        {!declared ? (
          <Tooltip label="This block does not declare a slot with this name, so saving will fail until its blocks are moved or removed.">
            <Badge color="yellow" size="xs">
              unknown slot
            </Badge>
          </Tooltip>
        ) : null}
      </Group>
      {children.length > 0 ? (
        <Stack gap="sm" mb="sm">
          {children.map((child, index) => (
            <BlockCard
              key={child.key}
              node={child}
              index={index}
              count={children.length}
              {...shared}
            />
          ))}
        </Stack>
      ) : null}
      <Button
        size="xs"
        variant="light"
        leftSection={<IconPlus size={14} />}
        onClick={() => shared.onOpenPicker({ parentKey: parent.key, slot: slotName })}
      >
        Add block
      </Button>
    </Box>
  );
}

function PropField({
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
function JsonValueField({
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
