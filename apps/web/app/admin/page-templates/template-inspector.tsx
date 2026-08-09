'use client';

import { Alert, Badge, Box, Code, Divider, Group, Stack, Tabs, Text } from '@mantine/core';
import { IconAlertCircle, IconLayoutBoard } from '@tabler/icons-react';
import { HelpTip } from '../../../components/help-tip';
import type { EditorNode } from '../pages/editor-state';
import { JsonValueField, PropField } from '../pages/prop-fields';
import { fieldSpecsFor } from '../pages/schema-form';
import { StylesPanel } from '../pages/styles-panel';
import type { Block } from '../pages/types';
import { DROP_ZONE_ERC, type PageTemplateKind } from './types';

const SLOT_HELP =
  'A slot is a space inside a block where other blocks can be placed. Add blocks to a slot directly on the canvas.';

// Right panel of the Template Studio: a trimmed version of the Page Studio's
// StudioInspector (no page status/settings section, since templates have no
// lifecycle). The drop zone gets a dedicated note instead of a props form:
// it accepts no props, styles or slots (spec 14 section 1).
export function TemplateInspector({
  kind,
  selectedNode,
  block,
  blocksLoading,
  tokens,
  onSetProp,
  onSetProps,
  onSetStyle,
}: {
  kind: PageTemplateKind;
  selectedNode: EditorNode | null;
  block: Block | null;
  blocksLoading: boolean;
  tokens: Record<string, string>;
  onSetProp: (key: string, name: string, value: unknown) => void;
  onSetProps: (key: string, props: Record<string, unknown>) => void;
  onSetStyle: (key: string, name: string, value: string | undefined) => void;
}) {
  return (
    <Stack gap="md" p="md">
      {selectedNode === null ? (
        <NothingSelected kind={kind} />
      ) : selectedNode.block === DROP_ZONE_ERC ? (
        <DropZonePanel />
      ) : (
        <BlockPanel
          node={selectedNode}
          block={block}
          blocksLoading={blocksLoading}
          tokens={tokens}
          onSetProp={onSetProp}
          onSetProps={onSetProps}
          onSetStyle={onSetStyle}
        />
      )}
    </Stack>
  );
}

function NothingSelected({ kind }: { kind: PageTemplateKind }) {
  return (
    <Box>
      <Text size="xs" fw={700} tt="uppercase" c="slate.5" lts="0.05em">
        {kind === 'MASTER' ? 'Master page' : 'Page template'}
      </Text>
      <Text size="xs" c="slate.4" mt={4}>
        Click a block on the canvas to edit it here.
      </Text>
    </Box>
  );
}

// The drop zone is not editable content: no props, no styles, no slots. Its
// only affordance is reordering among siblings, which the canvas already
// allows through the drag handle and move buttons.
function DropZonePanel() {
  return (
    <>
      <Group gap="xs">
        <IconLayoutBoard size={16} />
        <Text fw={600} size="sm">
          Page content
        </Text>
      </Group>
      <Text size="sm" c="slate.5">
        This marks where each page using this master fills in its own content. It has nothing to
        configure: no props, no styles, and it cannot hold nested blocks. Drag it to reorder it
        among the header and footer, but it cannot be duplicated or removed.
      </Text>
    </>
  );
}

function BlockPanel({
  node,
  block,
  blocksLoading,
  tokens,
  onSetProp,
  onSetProps,
  onSetStyle,
}: {
  node: EditorNode;
  block: Block | null;
  blocksLoading: boolean;
  tokens: Record<string, string>;
  onSetProp: (key: string, name: string, value: unknown) => void;
  onSetProps: (key: string, props: Record<string, unknown>) => void;
  onSetStyle: (key: string, name: string, value: string | undefined) => void;
}) {
  const specs = block ? fieldSpecsFor(block.propsSchema) : [];
  const declaredSlots = block?.slots ?? [];
  const extraSlotNames = Object.keys(node.slots).filter(
    (name) => !declaredSlots.some((slot) => slot.name === name),
  );

  return (
    <>
      <Box miw={0}>
        <Text fw={600} size="sm" truncate>
          {block ? block.name : node.block}
        </Text>
        {block && block.category !== null && block.category !== '' ? (
          <Badge color="slate" variant="outline" size="xs" mt={4}>
            {block.category}
          </Badge>
        ) : null}
      </Box>

      {!block && !blocksLoading ? (
        <Alert color="yellow" icon={<IconAlertCircle size={16} />} title="Missing block">
          No block with the reference <Code>{node.block}</Code> exists anymore. Saving will fail
          until this block is removed from the tree or recreated.
        </Alert>
      ) : null}

      {/* Remount when the selection changes so the active tab resets. */}
      <Tabs key={node.key} defaultValue="general" keepMounted={false}>
        <Tabs.List grow>
          <Tabs.Tab value="general">General</Tabs.Tab>
          <Tabs.Tab value="styles">Styles</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="general" pt="md">
          <Stack gap="md">
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
                onChange={(value) => onSetProp(node.key, spec.name, value)}
              />
            ))}
            {!block ? (
              <JsonValueField
                key={`${node.key}:props`}
                label="Props (JSON)"
                description="The block definition is unknown, so its values can only be edited as JSON."
                value={node.props}
                onChange={(value) =>
                  onSetProps(
                    node.key,
                    typeof value === 'object' && value !== null && !Array.isArray(value)
                      ? (value as Record<string, unknown>)
                      : {},
                  )
                }
              />
            ) : null}

            {declaredSlots.length > 0 || extraSlotNames.length > 0 ? (
              <>
                <Divider />
                <Box>
                  <Text size="xs" fw={700} tt="uppercase" c="slate.5" lts="0.05em" mb={4}>
                    Slots
                    <HelpTip label={SLOT_HELP} />
                  </Text>
                  <Stack gap={2}>
                    {declaredSlots.map((slot) => {
                      const count = (node.slots[slot.name] ?? []).length;
                      return (
                        <Text size="xs" c="slate.5" key={slot.name}>
                          {slot.name} · {count} block{count === 1 ? '' : 's'}
                        </Text>
                      );
                    })}
                    {extraSlotNames.map((name) => {
                      const count = (node.slots[name] ?? []).length;
                      return (
                        <Group gap={6} key={name}>
                          <Text size="xs" c="slate.5">
                            {name} · {count} block{count === 1 ? '' : 's'}
                          </Text>
                          <Badge color="yellow" size="xs">
                            unknown slot
                          </Badge>
                        </Group>
                      );
                    })}
                  </Stack>
                </Box>
              </>
            ) : null}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="styles" pt="md">
          <StylesPanel
            styles={node.styles}
            tokens={tokens}
            onSetStyle={(name, value) => onSetStyle(node.key, name, value)}
          />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
