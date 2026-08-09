'use client';

import {
  Alert,
  Button,
  Card,
  Group,
  JsonInput,
  List,
  Stack,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconCode, IconCube } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { HelpTip } from '../../../components/help-tip';
import { ApiError, api } from '../../../lib/api';
import { BlockCanvas } from './block-canvas';
import { type EditorNode, stateToTree, treeToState } from './editor-state';
import { type PageTree, PATH_PATTERN, parseTree, stringifyTree } from './tree-utils';
import type { Block } from './types';

export interface PageFormValues {
  title: string;
  path: string;
  tree: PageTree;
}

export function PageForm({
  initial,
  busy,
  serverError,
  submitLabel,
  onSubmit,
}: {
  initial?: { title: string; path: string; tree: PageTree };
  busy: boolean;
  serverError: ApiError | null;
  submitLabel: string;
  onSubmit: (values: PageFormValues) => void;
}) {
  const form = useForm({
    initialValues: { title: initial?.title ?? '', path: initial?.path ?? '/' },
    validate: {
      title: (value) => (value.trim() === '' ? 'Give the page a title.' : null),
      path: (value) =>
        PATH_PATTERN.test(value)
          ? null
          : 'The path must start with "/" and use only lowercase letters, digits, "/" and "-".',
    },
  });
  const [nodes, setNodes] = useState<EditorNode[]>(() =>
    treeToState(initial?.tree ?? { blocks: [] }),
  );
  const [tab, setTab] = useState<string | null>('blocks');
  const [advancedText, setAdvancedText] = useState('');
  const [advancedError, setAdvancedError] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ data: Block[] }>('/blocks?limit=100')
      .then(({ data }) => setBlocks(data))
      .catch((error: unknown) => {
        notifications.show({
          color: 'red',
          title: 'Could not load blocks',
          message: error instanceof ApiError ? error.message : 'Request failed',
        });
      })
      .finally(() => setBlocksLoading(false));
  }, []);

  // Map field-level validation messages from the server onto the inputs.
  useEffect(() => {
    if (!serverError) {
      return;
    }
    for (const message of serverError.problem.errors ?? []) {
      const lower = message.toLowerCase();
      if (lower.startsWith('title')) {
        form.setFieldError('title', message);
      } else if (lower.startsWith('path')) {
        form.setFieldError('path', message);
      }
    }
    // form is stable between renders; re-run only on a new server error.
  }, [serverError]);

  const blocksByErc = useMemo(
    () => new Map(blocks.map((block) => [block.externalReferenceCode, block])),
    [blocks],
  );

  function handleTabChange(next: string | null) {
    if (next === null || next === tab) {
      return;
    }
    if (next === 'advanced') {
      setAdvancedText(stringifyTree(stateToTree(nodes)));
      setAdvancedError(null);
      setTab('advanced');
      return;
    }
    // Leaving Advanced: the JSON must parse before the visual editor takes over.
    const parsed = parseTree(advancedText);
    if (!parsed.ok) {
      setAdvancedError(parsed.error);
      return;
    }
    setNodes(treeToState(parsed.tree));
    setAdvancedError(null);
    setTab('blocks');
  }

  function handleSubmit(values: { title: string; path: string }) {
    let tree: PageTree;
    if (tab === 'advanced') {
      const parsed = parseTree(advancedText);
      if (!parsed.ok) {
        setAdvancedError(parsed.error);
        return;
      }
      setNodes(treeToState(parsed.tree));
      tree = parsed.tree;
    } else {
      tree = stateToTree(nodes);
    }
    onSubmit({ title: values.title.trim(), path: values.path, tree });
  }

  const serverMessages = serverError?.problem.errors ?? [];

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="lg">
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

        <Card padding="lg">
          <Group grow align="flex-start">
            <TextInput
              label="Title"
              description="The name of the page, shown in menus and browser tabs."
              required
              maxLength={255}
              {...form.getInputProps('title')}
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
              maxLength={255}
              placeholder="/home"
              {...form.getInputProps('path')}
            />
          </Group>
        </Card>

        <Tabs value={tab} onChange={handleTabChange} keepMounted={false}>
          <Tabs.List>
            <Tabs.Tab value="blocks" leftSection={<IconCube size={15} />}>
              Blocks
            </Tabs.Tab>
            <Tabs.Tab value="advanced" leftSection={<IconCode size={15} />}>
              Advanced
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="blocks" pt="md">
            <BlockCanvas
              nodes={nodes}
              onNodesChange={setNodes}
              blocks={blocks}
              blocksByErc={blocksByErc}
              blocksLoading={blocksLoading}
            />
          </Tabs.Panel>
          <Tabs.Panel value="advanced" pt="md">
            <Stack gap="sm">
              {advancedError !== null ? (
                <Alert
                  color="red"
                  icon={<IconAlertCircle size={16} />}
                  title="Fix the JSON to continue"
                >
                  {advancedError}
                </Alert>
              ) : null}
              <JsonInput
                aria-label="Page tree JSON"
                description="The raw page tree, exactly as the API stores it. Changes made here show up in the visual editor once the JSON is valid."
                autosize
                minRows={14}
                maxRows={32}
                value={advancedText}
                styles={{ input: { fontFamily: 'var(--font-mono), monospace' } }}
                onChange={(next) => {
                  setAdvancedText(next);
                  setAdvancedError(null);
                }}
              />
            </Stack>
          </Tabs.Panel>
        </Tabs>

        <Group>
          <Button type="submit" loading={busy}>
            {submitLabel}
          </Button>
          <Button component={Link} href="/admin/pages" variant="subtle" color="slate">
            Cancel
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
