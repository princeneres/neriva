'use client';

import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Box,
  Code,
  Divider,
  Group,
  List,
  Stack,
  Tabs,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconAlertCircle, IconSettings, IconX } from '@tabler/icons-react';
import Link from 'next/link';
import { HelpTip } from '../../../components/help-tip';
import type { ApiError } from '../../../lib/api';
import type { EditorNode } from './editor-state';
import { JsonValueField, PropField } from './prop-fields';
import { fieldSpecsFor } from './schema-form';
import classes from './studio.module.css';
import { StylesPanel } from './styles-panel';
import { type Block, type EntityStatus, statusColor } from './types';

const SLOT_HELP =
  'A slot is a space inside a block where other blocks can be placed. Add blocks to a slot directly on the page.';

export interface PageMeta {
  id: string;
  externalReferenceCode: string;
}

// Right panel of the studio. With nothing selected it shows the page status
// and a link to the page settings; with a block selected it becomes the
// block's properties form, editing the canvas live per keystroke.
export function StudioInspector({
  serverError,
  settingsHref,
  status,
  pageMeta,
  selectedNode,
  block,
  blocksLoading,
  tokens,
  onSetProp,
  onSetProps,
  onSetStyle,
  onDeselect,
}: {
  serverError: ApiError | null;
  settingsHref: string;
  status: EntityStatus;
  pageMeta: PageMeta;
  selectedNode: EditorNode | null;
  block: Block | null;
  blocksLoading: boolean;
  tokens: Record<string, string>;
  onSetProp: (key: string, name: string, value: unknown) => void;
  onSetProps: (key: string, props: Record<string, unknown>) => void;
  onSetStyle: (key: string, name: string, value: string | undefined) => void;
  onDeselect: () => void;
}) {
  const serverMessages = serverError?.problem.errors ?? [];

  return (
    <div className={classes.inspector}>
      <Stack gap="md" p="md">
        {serverError ? (
          <Alert
            color="red"
            icon={<IconAlertCircle size={16} />}
            title="The page could not be saved"
          >
            <Text size="sm">{serverError.message}</Text>
            {serverMessages.length > 0 ? (
              <List size="sm" mt={4}>
                {serverMessages.map((message) => (
                  <List.Item key={message}>{message}</List.Item>
                ))}
              </List>
            ) : null}
          </Alert>
        ) : null}

        {selectedNode === null ? (
          <PagePanel settingsHref={settingsHref} status={status} pageMeta={pageMeta} />
        ) : (
          <BlockPanel
            node={selectedNode}
            block={block}
            blocksLoading={blocksLoading}
            tokens={tokens}
            onSetProp={onSetProp}
            onSetProps={onSetProps}
            onSetStyle={onSetStyle}
            onDeselect={onDeselect}
          />
        )}
      </Stack>
    </div>
  );
}

function PagePanel({
  settingsHref,
  status,
  pageMeta,
}: {
  settingsHref: string;
  status: EntityStatus;
  pageMeta: PageMeta;
}) {
  return (
    <>
      <Box>
        <Text size="xs" fw={700} tt="uppercase" c="slate.5" lts="0.05em">
          Page
        </Text>
        <Text size="xs" c="slate.4">
          Click a block on the page to edit it here.
        </Text>
      </Box>
      <Box>
        <Group gap="xs" mb={4}>
          <Text size="sm" fw={600}>
            Status
          </Text>
          <Badge color={statusColor(status)}>{status}</Badge>
        </Group>
        <Text size="xs" c="slate.5">
          {status === 'PUBLISHED'
            ? 'This page is live. Saved changes only reach visitors when you publish again.'
            : status === 'ARCHIVED'
              ? 'This page is archived and not visible to visitors.'
              : 'Drafts are safe to work on; visitors only see the page after you publish it.'}
        </Text>
      </Box>
      <Divider />
      <Box>
        <Anchor component={Link} href={settingsHref} size="sm" fw={600}>
          <Group gap={6} wrap="nowrap">
            <IconSettings size={15} />
            Page settings
          </Group>
        </Anchor>
        <Text size="xs" c="slate.5" mt={4}>
          The title, the address and publishing are managed in the page settings.
        </Text>
      </Box>
      <Box>
        <Text size="xs" c="slate.4">
          ID <Code>{pageMeta.id}</Code>
        </Text>
        <Text size="xs" c="slate.4" mt={2}>
          Reference <Code>{pageMeta.externalReferenceCode}</Code>
        </Text>
      </Box>
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
  onDeselect,
}: {
  node: EditorNode;
  block: Block | null;
  blocksLoading: boolean;
  tokens: Record<string, string>;
  onSetProp: (key: string, name: string, value: unknown) => void;
  onSetProps: (key: string, props: Record<string, unknown>) => void;
  onSetStyle: (key: string, name: string, value: string | undefined) => void;
  onDeselect: () => void;
}) {
  const specs = block ? fieldSpecsFor(block.propsSchema) : [];
  const declaredSlots = block?.slots ?? [];
  const extraSlotNames = Object.keys(node.slots).filter(
    (name) => !declaredSlots.some((slot) => slot.name === name),
  );

  return (
    <>
      <Group justify="space-between" wrap="nowrap" align="flex-start">
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
        <Tooltip label="Deselect (Esc)">
          <ActionIcon
            variant="subtle"
            color="slate"
            size="sm"
            onClick={onDeselect}
            aria-label="Deselect block"
          >
            <IconX size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {!block && !blocksLoading ? (
        <Alert color="yellow" icon={<IconAlertCircle size={16} />} title="Missing block">
          No block with the reference <Code>{node.block}</Code> exists anymore. Saving will fail
          until this block is removed from the page or recreated.
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
                    // Only objects are valid props; anything else clears them.
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
                          <Tooltip label="This block does not declare a slot with this name, so saving will fail until its blocks are moved or removed.">
                            <Badge color="yellow" size="xs">
                              unknown slot
                            </Badge>
                          </Tooltip>
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
