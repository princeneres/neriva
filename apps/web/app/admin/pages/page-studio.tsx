'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Group,
  JsonInput,
  Menu,
  Modal,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCode,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconDeviceTablet,
  IconDots,
  IconExternalLink,
  IconGripVertical,
  IconRocket,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, api } from '../../../lib/api';
import { BlockPickerModal } from './block-picker';
import { type CanvasDevice, EditorCanvas, type InsertTarget, ROOT_DROP_ID } from './editor-canvas';
import {
  duplicateNode,
  type EditorNode,
  findNode,
  insertNode,
  insertRootNodeAt,
  moveNode,
  removeNode,
  reorderNodes,
  setNodeProp,
  setNodeProps,
  stateToTree,
  treeToState,
} from './editor-state';
import { type PageMeta, StudioInspector } from './studio-inspector';
import { PALETTE_ID_PREFIX, StudioPalette } from './studio-palette';
import classes from './studio.module.css';
import { type PageTree, parseTree, PATH_PATTERN, stringifyTree } from './tree-utils';
import { type Block, type EntityStatus, statusColor } from './types';

export interface PageStudioValues {
  title: string;
  path: string;
  tree: PageTree;
}

const PATH_ERROR =
  'The path must start with "/" and use only lowercase letters, digits, "/" and "-".';

// The Page Studio: a WYSIWYG editor where the rendered page is the canvas.
// Left palette inserts blocks, clicking a block on the page selects it, the
// right inspector edits it live. Used by both the new-page and edit routes;
// all API calls stay in the routes and flow in via onSave/onPublish.
export function PageStudio({
  initial,
  status,
  pageMeta,
  siteSlug,
  busy,
  serverError,
  saveLabel,
  viewUrl,
  onSave,
  onPublish,
}: {
  initial?: { title: string; path: string; tree: PageTree };
  status: EntityStatus | null;
  pageMeta: PageMeta | null;
  siteSlug: string | null;
  busy: boolean;
  serverError: ApiError | null;
  saveLabel: string;
  viewUrl: string | null;
  onSave: (values: PageStudioValues) => void;
  onPublish?: () => void;
}) {
  const [nodes, setNodes] = useState<EditorNode[]>(() =>
    treeToState(initial?.tree ?? { blocks: [] }),
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [device, setDevice] = useState<CanvasDevice>('desktop');
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);

  const [title, setTitle] = useState(initial?.title ?? '');
  const [path, setPath] = useState(initial?.path ?? '/');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [pathError, setPathError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);

  const [insertTarget, setInsertTarget] = useState<InsertTarget | null>(null);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [dragLabel, setDragLabel] = useState<string | null>(null);

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

  // Esc deselects the current block anywhere in the studio.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectedKey(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Map field-level validation messages from the server onto the page inputs.
  useEffect(() => {
    if (!serverError) {
      return;
    }
    for (const message of serverError.problem.errors ?? []) {
      const lower = message.toLowerCase();
      if (lower.startsWith('title')) {
        setTitleError(message);
      } else if (lower.startsWith('path')) {
        setPathError(message);
      }
    }
  }, [serverError]);

  const blocksByErc = useMemo(
    () => new Map(blocks.map((block) => [block.externalReferenceCode, block])),
    [blocks],
  );
  const selectedNode = selectedKey === null ? null : findNode(nodes, selectedKey);
  const selectedBlock = selectedNode ? (blocksByErc.get(selectedNode.block) ?? null) : null;

  // A small distance threshold keeps plain clicks (select, palette add) working.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleSave() {
    const nextTitleError = title.trim() === '' ? 'Give the page a title.' : null;
    const nextPathError = PATH_PATTERN.test(path) ? null : PATH_ERROR;
    setTitleError(nextTitleError);
    setPathError(nextPathError);
    if (nextTitleError !== null || nextPathError !== null) {
      setSelectedKey(null);
      notifications.show({
        color: 'red',
        message: 'Fill in the page details in the panel on the right first.',
      });
      return;
    }
    onSave({ title: title.trim(), path, tree: stateToTree(nodes) });
  }

  function confirmPublish() {
    if (!onPublish) {
      return;
    }
    modals.openConfirmModal({
      title: 'Publish page',
      children: (
        <Text size="sm">
          Publish &quot;{title.trim() === '' ? 'this page' : title}&quot;? It becomes visible to
          visitors at <Text component="code">{path}</Text>. Unsaved changes in the editor are not
          included; save first if you made edits.
        </Text>
      ),
      labels: { confirm: 'Publish', cancel: 'Not yet' },
      onConfirm: () => onPublish(),
    });
  }

  function handlePick(block: Block) {
    if (insertTarget === null) {
      return;
    }
    const result =
      insertTarget.kind === 'root'
        ? insertRootNodeAt(nodes, insertTarget.index, block.externalReferenceCode)
        : insertNode(
            nodes,
            { parentKey: insertTarget.parentKey, slot: insertTarget.slot },
            block.externalReferenceCode,
          );
    setNodes(result.nodes);
    setSelectedKey(result.key);
    setInsertTarget(null);
  }

  function handlePaletteAdd(block: Block) {
    const result = insertNode(nodes, null, block.externalReferenceCode);
    setNodes(result.nodes);
    setSelectedKey(result.key);
  }

  function handleRemove(key: string) {
    const node = findNode(nodes, key);
    if (node === null) {
      return;
    }
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
      onConfirm: () => {
        const next = removeNode(nodes, key);
        setNodes(next);
        if (selectedKey !== null && findNode(next, selectedKey) === null) {
          setSelectedKey(null);
        }
      },
    });
  }

  function handleDuplicate(key: string) {
    const result = duplicateNode(nodes, key);
    if (result.key !== null) {
      setNodes(result.nodes);
      setSelectedKey(result.key);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    if (id.startsWith(PALETTE_ID_PREFIX)) {
      const erc = id.slice(PALETTE_ID_PREFIX.length);
      setDragLabel(blocksByErc.get(erc)?.name ?? erc);
      return;
    }
    const node = findNode(nodes, id);
    setDragLabel(node ? (blocksByErc.get(node.block)?.name ?? node.block) : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragLabel(null);
    const activeId = String(event.active.id);
    const overId = event.over === null ? null : String(event.over.id);
    if (activeId.startsWith(PALETTE_ID_PREFIX)) {
      if (overId === null) {
        return;
      }
      const erc = activeId.slice(PALETTE_ID_PREFIX.length);
      // Dropping over a root block inserts at its position; anywhere else on
      // the canvas appends at the end.
      const rootIndex = nodes.findIndex((node) => node.key === overId);
      const result = insertRootNodeAt(nodes, rootIndex === -1 ? nodes.length : rootIndex, erc);
      setNodes(result.nodes);
      setSelectedKey(result.key);
      return;
    }
    if (overId !== null && overId !== activeId && overId !== ROOT_DROP_ID) {
      setNodes(reorderNodes(nodes, activeId, overId));
    }
  }

  function openJsonModal() {
    setJsonText(stringifyTree(stateToTree(nodes)));
    setJsonError(null);
    setJsonOpen(true);
  }

  function applyJson() {
    const parsed = parseTree(jsonText);
    if (!parsed.ok) {
      setJsonError(parsed.error);
      return;
    }
    setNodes(treeToState(parsed.tree));
    setSelectedKey(null);
    setJsonOpen(false);
  }

  return (
    <div className={classes.studio}>
      <div className={classes.topBar}>
        <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Tooltip label="Back to pages">
            <ActionIcon
              variant="subtle"
              color="slate"
              component={Link}
              href="/admin/pages"
              aria-label="Back to the pages list"
            >
              <IconArrowLeft size={18} />
            </ActionIcon>
          </Tooltip>
          {editingTitle ? (
            <TextInput
              size="xs"
              w={240}
              value={title}
              placeholder="Untitled page"
              aria-label="Page title"
              data-autofocus
              autoFocus
              onChange={(event) => {
                setTitle(event.currentTarget.value);
                setTitleError(null);
              }}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === 'Escape') {
                  setEditingTitle(false);
                }
              }}
            />
          ) : (
            <Tooltip label="Click to rename">
              <UnstyledButton
                onClick={() => setEditingTitle(true)}
                style={{ minWidth: 0 }}
                aria-label="Rename the page"
              >
                <Text fw={600} truncate c={title.trim() === '' ? 'slate.4' : undefined}>
                  {title.trim() === '' ? 'Untitled page' : title}
                </Text>
              </UnstyledButton>
            </Tooltip>
          )}
          <Badge color={statusColor(status ?? 'DRAFT')} style={{ flexShrink: 0 }}>
            {status ?? 'DRAFT'}
          </Badge>
        </Group>

        <SegmentedControl
          size="xs"
          value={device}
          onChange={(next) =>
            setDevice(next === 'tablet' ? 'tablet' : next === 'mobile' ? 'mobile' : 'desktop')
          }
          data={[
            {
              value: 'desktop',
              label: (
                <Center>
                  <IconDeviceDesktop size={15} aria-label="Desktop width" />
                </Center>
              ),
            },
            {
              value: 'tablet',
              label: (
                <Center>
                  <IconDeviceTablet size={15} aria-label="Tablet width" />
                </Center>
              ),
            },
            {
              value: 'mobile',
              label: (
                <Center>
                  <IconDeviceMobile size={15} aria-label="Mobile width" />
                </Center>
              ),
            },
          ]}
        />

        <Group gap="xs" wrap="nowrap" justify="flex-end" style={{ flex: 1 }}>
          <Button size="xs" loading={busy} onClick={handleSave}>
            {saveLabel}
          </Button>
          {onPublish ? (
            <Button
              size="xs"
              variant="light"
              leftSection={<IconRocket size={15} />}
              disabled={busy}
              onClick={confirmPublish}
            >
              Publish
            </Button>
          ) : null}
          {viewUrl !== null ? (
            <Tooltip label="View the live page in a new tab">
              <ActionIcon
                variant="light"
                component="a"
                href={viewUrl}
                target="_blank"
                rel="noopener"
                aria-label="View the live page"
              >
                <IconExternalLink size={16} />
              </ActionIcon>
            </Tooltip>
          ) : null}
          <Menu position="bottom-end" width={200}>
            <Menu.Target>
              <ActionIcon variant="subtle" color="slate" aria-label="More actions">
                <IconDots size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconCode size={15} />} onClick={openJsonModal}>
                Edit tree as JSON
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDragLabel(null)}
      >
        <div className={classes.body}>
          <StudioPalette
            blocks={blocks}
            loading={blocksLoading}
            collapsed={paletteCollapsed}
            onToggleCollapsed={() => setPaletteCollapsed((current) => !current)}
            onAdd={handlePaletteAdd}
          />
          <EditorCanvas
            nodes={nodes}
            device={device}
            siteSlug={siteSlug}
            blocksByErc={blocksByErc}
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
            onMove={(key, direction) => setNodes(moveNode(nodes, key, direction))}
            onDuplicate={handleDuplicate}
            onRemove={handleRemove}
            onOpenPicker={setInsertTarget}
          />
          <StudioInspector
            serverError={serverError}
            title={title}
            path={path}
            titleError={titleError}
            pathError={pathError}
            onTitleChange={(value) => {
              setTitle(value);
              setTitleError(null);
            }}
            onPathChange={(value) => {
              setPath(value);
              setPathError(PATH_PATTERN.test(value) ? null : PATH_ERROR);
            }}
            status={status}
            pageMeta={pageMeta}
            selectedNode={selectedNode}
            block={selectedBlock}
            blocksLoading={blocksLoading}
            onSetProp={(key, name, value) => setNodes(setNodeProp(nodes, key, name, value))}
            onSetProps={(key, props) => setNodes(setNodeProps(nodes, key, props))}
            onDeselect={() => setSelectedKey(null)}
          />
        </div>
        <DragOverlay>
          {dragLabel !== null ? (
            <Card padding="xs" withBorder shadow="md">
              <Group gap={6} wrap="nowrap">
                <IconGripVertical size={14} color="var(--mantine-color-slate-4)" />
                <Text size="sm" fw={600}>
                  {dragLabel}
                </Text>
              </Group>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

      <BlockPickerModal
        opened={insertTarget !== null}
        onClose={() => setInsertTarget(null)}
        blocks={blocks}
        loading={blocksLoading}
        onPick={handlePick}
      />

      <Modal
        opened={jsonOpen}
        onClose={() => setJsonOpen(false)}
        title="Edit tree as JSON"
        size="lg"
      >
        <Stack gap="sm">
          <Text size="xs" c="slate.5">
            The raw page tree, exactly as the API stores it. Applying replaces what is on the
            canvas; nothing is saved until you use {saveLabel}.
          </Text>
          {jsonError !== null ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={16} />}
              title="Fix the JSON to continue"
            >
              {jsonError}
            </Alert>
          ) : null}
          <JsonInput
            aria-label="Page tree JSON"
            autosize
            minRows={12}
            maxRows={26}
            value={jsonText}
            styles={{ input: { fontFamily: 'var(--font-mono), monospace' } }}
            onChange={(next) => {
              setJsonText(next);
              setJsonError(null);
            }}
          />
          <Group justify="flex-end">
            <Button variant="subtle" color="slate" onClick={() => setJsonOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyJson}>Apply</Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
