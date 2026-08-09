'use client';

import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Code,
  Divider,
  Group,
  List,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconAlertCircle, IconX } from '@tabler/icons-react';
import { HelpTip } from '../../../components/help-tip';
import type { ApiError } from '../../../lib/api';
import type { EditorNode } from './editor-state';
import { JsonValueField, PropField } from './prop-fields';
import { fieldSpecsFor } from './schema-form';
import classes from './studio.module.css';
import { type Block, type EntityStatus, statusColor } from './types';

const SLOT_HELP =
  'A slot is a space inside a block where other blocks can be placed. Add blocks to a slot directly on the page.';

export interface PageMeta {
  id: string;
  externalReferenceCode: string;
}

// Right panel of the studio. With nothing selected it shows the page details
// (title, path, status); with a block selected it becomes the block's
// properties form, editing the canvas live per keystroke.
export function StudioInspector({
  serverError,
  title,
  path,
  titleError,
  pathError,
  onTitleChange,
  onPathChange,
  status,
  pageMeta,
  selectedNode,
  block,
  blocksLoading,
  onSetProp,
  onSetProps,
  onDeselect,
}: {
  serverError: ApiError | null;
  title: string;
  path: string;
  titleError: string | null;
  pathError: string | null;
  onTitleChange: (value: string) => void;
  onPathChange: (value: string) => void;
  status: EntityStatus | null;
  pageMeta: PageMeta | null;
  selectedNode: EditorNode | null;
  block: Block | null;
  blocksLoading: boolean;
  onSetProp: (key: string, name: string, value: unknown) => void;
  onSetProps: (key: string, props: Record<string, unknown>) => void;
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
          <PagePanel
            title={title}
            path={path}
            titleError={titleError}
            pathError={pathError}
            onTitleChange={onTitleChange}
            onPathChange={onPathChange}
            status={status}
            pageMeta={pageMeta}
          />
        ) : (
          <BlockPanel
            node={selectedNode}
            block={block}
            blocksLoading={blocksLoading}
            onSetProp={onSetProp}
            onSetProps={onSetProps}
            onDeselect={onDeselect}
          />
        )}
      </Stack>
    </div>
  );
}

function PagePanel({
  title,
  path,
  titleError,
  pathError,
  onTitleChange,
  onPathChange,
  status,
  pageMeta,
}: {
  title: string;
  path: string;
  titleError: string | null;
  pathError: string | null;
  onTitleChange: (value: string) => void;
  onPathChange: (value: string) => void;
  status: EntityStatus | null;
  pageMeta: PageMeta | null;
}) {
  return (
    <>
      <Box>
        <Text size="xs" fw={700} tt="uppercase" c="slate.5" lts="0.05em">
          Page
        </Text>
        <Text size="xs" c="slate.4">
          Click a block on the page to edit it here instead.
        </Text>
      </Box>
      <TextInput
        label="Title"
        description="The name of the page, shown in menus and browser tabs."
        required
        size="sm"
        maxLength={255}
        value={title}
        error={titleError}
        onChange={(event) => onTitleChange(event.currentTarget.value)}
      />
      <TextInput
        label={
          <>
            Path
            <HelpTip label="The address of the page inside its site, for example /about. Only lowercase letters, digits, / and - are allowed." />
          </>
        }
        description="Where the page lives, for example /about."
        required
        size="sm"
        maxLength={255}
        placeholder="/home"
        value={path}
        error={pathError}
        onChange={(event) => onPathChange(event.currentTarget.value)}
      />
      <Divider />
      <Box>
        <Group gap="xs" mb={4}>
          <Text size="sm" fw={600}>
            Status
          </Text>
          <Badge color={statusColor(status ?? 'DRAFT')}>{status ?? 'DRAFT'}</Badge>
        </Group>
        <Text size="xs" c="slate.5">
          {status === 'PUBLISHED'
            ? 'This page is live. Saved changes only reach visitors when you publish again.'
            : status === 'ARCHIVED'
              ? 'This page is archived and not visible to visitors.'
              : status === null
                ? 'This page has not been created yet. Fill in a title and a path, then use Create page in the top bar.'
                : 'Drafts are safe to work on; visitors only see the page after you publish it.'}
        </Text>
      </Box>
      {pageMeta !== null ? (
        <Box>
          <Text size="xs" c="slate.4">
            ID <Code>{pageMeta.id}</Code>
          </Text>
          <Text size="xs" c="slate.4" mt={2}>
            Reference <Code>{pageMeta.externalReferenceCode}</Code>
          </Text>
        </Box>
      ) : null}
    </>
  );
}

function BlockPanel({
  node,
  block,
  blocksLoading,
  onSetProp,
  onSetProps,
  onDeselect,
}: {
  node: EditorNode;
  block: Block | null;
  blocksLoading: boolean;
  onSetProp: (key: string, name: string, value: unknown) => void;
  onSetProps: (key: string, props: Record<string, unknown>) => void;
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

      <Divider />

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
    </>
  );
}
