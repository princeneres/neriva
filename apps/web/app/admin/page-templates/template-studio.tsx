'use client';

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { components } from '@neriva/contracts';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconArrowLeft, IconGripVertical } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, api } from '../../../lib/api';
import { BlockPickerModal } from '../pages/block-picker';
import {
  type CanvasDropData,
  type DropTarget,
  EditorCanvas,
  type InsertTarget,
} from '../pages/editor-canvas';
import {
  type ContainerRef,
  containerKey,
  duplicateNode,
  type EditorNode,
  findNode,
  insertNode,
  insertNodeAt,
  moveNode,
  moveNodeToContainer,
  removeNode,
  setNodeProp,
  setNodeProps,
  setNodeStyle,
  stateToTree,
  treeToState,
} from '../pages/editor-state';
import { PALETTE_ID_PREFIX, StudioPalette } from '../pages/studio-palette';
import type { PageTree } from '../pages/tree-utils';
import type { Block } from '../pages/types';
import { TemplateInspector } from './template-inspector';
import classes from './template-studio.module.css';
import { DROP_ZONE_ERC, pageContentPaletteBlock, type PageTemplateKind } from './types';

type StyleBook = components['schemas']['StyleBookDto'];

export interface TemplateStudioValues {
  name: string;
  tree: PageTree;
}

function hasDropZone(nodes: EditorNode[]): boolean {
  return nodes.some(
    (node) => node.block === DROP_ZONE_ERC || Object.values(node.slots).some(hasDropZone),
  );
}

// The Template Studio: a lighter cut of the Page Studio (spec 14 section 4).
// No publish/view/device toolbar and no page settings; just palette, canvas
// and inspector around a name field and a Save button. Every tree mutation
// goes through editor-state.ts unchanged so behavior matches the page
// editor exactly.
export function TemplateStudio({
  kind,
  initialName,
  initialTree,
  backHref,
  busy,
  serverError,
  onSave,
  isDefault,
  settingDefault,
  onSetDefault,
}: {
  kind: PageTemplateKind;
  initialName: string;
  initialTree: PageTree;
  backHref: string;
  busy: boolean;
  serverError: ApiError | null;
  onSave: (values: TemplateStudioValues) => void;
  // Undefined until the template has been saved at least once (no id to mark
  // default yet, spec 14 section 4): the control only appears once there is
  // something to mark. isDefault mirrors PageTemplateDto.isDefault.
  isDefault?: boolean;
  settingDefault?: boolean;
  onSetDefault?: () => void;
}) {
  const [nodes, setNodes] = useState<EditorNode[]>(() => treeToState(initialTree));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);

  const [name, setName] = useState(initialName);
  const [nameError, setNameError] = useState<string | null>(null);

  const [insertTarget, setInsertTarget] = useState<InsertTarget | null>(null);
  const [dragLabel, setDragLabel] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const dropContainerRef = useRef<ContainerRef>(null);

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(true);
  const [tokens, setTokens] = useState<Record<string, string>>({});

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

  useEffect(() => {
    api
      .get<{ data: StyleBook[] }>('/style-books?limit=100')
      .then(({ data }) => {
        const published = data
          .filter((book) => book.status === 'PUBLISHED')
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        setTokens(published?.tokens ?? {});
      })
      .catch(() => {
        // Styles tab falls back to custom values only.
      });
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectedKey(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!serverError) {
      return;
    }
    for (const message of serverError.problem.errors ?? []) {
      if (message.toLowerCase().startsWith('name')) {
        setNameError(message);
      }
    }
  }, [serverError]);

  // MASTER templates get a synthetic "Page content" entry in the palette and
  // picker, hidden once the tree already has a drop zone (the API rejects a
  // second one anyway). It is not a real block: it renders a placeholder
  // card via its own html template and inserts through the same editor
  // helpers as any other block.
  const paletteBlocks = useMemo(() => {
    if (kind !== 'MASTER' || hasDropZone(nodes)) {
      return blocks;
    }
    return [...blocks, pageContentPaletteBlock()];
  }, [blocks, kind, nodes]);

  const blocksByErc = useMemo(
    () => new Map(paletteBlocks.map((block) => [block.externalReferenceCode, block])),
    [paletteBlocks],
  );
  const selectedNode = selectedKey === null ? null : findNode(nodes, selectedKey);
  const selectedBlock = selectedNode ? (blocksByErc.get(selectedNode.block) ?? null) : null;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleSave() {
    if (name.trim() === '') {
      setNameError('Give the template a name.');
      notifications.show({
        color: 'red',
        message: 'Give the template a name in the top bar first.',
      });
      return;
    }
    onSave({ name: name.trim(), tree: stateToTree(nodes) });
  }

  function handlePick(block: Block) {
    if (insertTarget === null) {
      return;
    }
    const result =
      insertTarget.kind === 'root'
        ? insertNodeAt(nodes, null, insertTarget.index, block.externalReferenceCode)
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

  // The drop zone can be reordered but never removed or duplicated (spec 14
  // section 4); the mini-toolbar buttons stay visible (reused unmodified
  // from the page editor canvas) but are inert for this node.
  function handleRemove(key: string) {
    const node = findNode(nodes, key);
    if (node === null) {
      return;
    }
    if (node.block === DROP_ZONE_ERC) {
      notifications.show({
        color: 'yellow',
        message: 'The page content marker cannot be removed.',
      });
      return;
    }
    const blockName = blocksByErc.get(node.block)?.name ?? node.block;
    modals.openConfirmModal({
      title: 'Remove block',
      children: (
        <Text size="sm">
          Remove &quot;{blockName}&quot; from this template? Blocks placed inside it are removed
          too. This only changes the draft; nothing happens until you save.
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
    const node = findNode(nodes, key);
    if (node !== null && node.block === DROP_ZONE_ERC) {
      notifications.show({
        color: 'yellow',
        message: 'The page content marker cannot be duplicated.',
      });
      return;
    }
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

  function containerChildren(container: ContainerRef): EditorNode[] {
    if (container === null) {
      return nodes;
    }
    return findNode(nodes, container.parentKey)?.slots[container.slot] ?? [];
  }

  function resolveDropTarget(
    event: DragMoveEvent,
  ): { container: ContainerRef; index: number } | null {
    if (event.over === null) {
      return null;
    }
    const data = event.over.data.current as CanvasDropData | undefined;
    if (data === undefined) {
      return null;
    }
    let index: number;
    if (data.kind === 'node') {
      const activeRect = event.active.rect.current.translated;
      const midpoint = event.over.rect.top + event.over.rect.height / 2;
      const activeCenter = activeRect === null ? midpoint : activeRect.top + activeRect.height / 2;
      index = activeCenter < midpoint ? data.index : data.index + 1;
    } else {
      index = containerChildren(data.container).length;
    }
    const activeId = String(event.active.id);
    if (!activeId.startsWith(PALETTE_ID_PREFIX) && data.container !== null) {
      const dragged = findNode(nodes, activeId);
      if (dragged === null || findNode([dragged], data.container.parentKey) !== null) {
        return null;
      }
    }
    return { container: data.container, index };
  }

  function handleDragMove(event: DragMoveEvent) {
    const resolved = resolveDropTarget(event);
    if (resolved === null) {
      dropContainerRef.current = null;
      setDropTarget(null);
      return;
    }
    dropContainerRef.current = resolved.container;
    setDropTarget({ containerKey: containerKey(resolved.container), index: resolved.index });
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragLabel(null);
    const target = dropTarget;
    const container = dropContainerRef.current;
    setDropTarget(null);
    dropContainerRef.current = null;
    if (event.over === null || target === null) {
      return;
    }
    const activeId = String(event.active.id);
    if (activeId.startsWith(PALETTE_ID_PREFIX)) {
      const erc = activeId.slice(PALETTE_ID_PREFIX.length);
      const result = insertNodeAt(nodes, container, target.index, erc);
      setNodes(result.nodes);
      setSelectedKey(result.key);
      return;
    }
    setNodes(moveNodeToContainer(nodes, activeId, container, target.index));
  }

  function handleDragCancel() {
    setDragLabel(null);
    setDropTarget(null);
    dropContainerRef.current = null;
  }

  return (
    <div className={classes.studio}>
      <div className={classes.topBar}>
        <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Tooltip label="Back to page templates">
            <ActionIcon
              variant="subtle"
              color="slate"
              component={Link}
              href={backHref}
              aria-label="Back to page templates"
            >
              <IconArrowLeft size={18} />
            </ActionIcon>
          </Tooltip>
          <TextInput
            size="xs"
            w={260}
            value={name}
            placeholder={kind === 'MASTER' ? 'Untitled master' : 'Untitled template'}
            aria-label="Template name"
            error={nameError}
            onChange={(event) => {
              setName(event.currentTarget.value);
              setNameError(null);
            }}
          />
          <Badge color={kind === 'MASTER' ? 'neriva' : 'slate'} style={{ flexShrink: 0 }}>
            {kind === 'MASTER' ? 'Master' : 'Template'}
          </Badge>
          {kind === 'MASTER' && isDefault ? (
            <Badge color="green" variant="light" style={{ flexShrink: 0 }}>
              Default
            </Badge>
          ) : null}
        </Group>

        <Group gap="xs" wrap="nowrap" justify="flex-end">
          {kind === 'MASTER' && isDefault === false && onSetDefault ? (
            <Tooltip label="Pages that set no master page of their own will use this one">
              <Button size="xs" variant="default" loading={settingDefault} onClick={onSetDefault}>
                Set as default
              </Button>
            </Tooltip>
          ) : null}
          <Button size="xs" loading={busy} onClick={handleSave}>
            Save
          </Button>
        </Group>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className={classes.body}>
          <StudioPalette
            blocks={paletteBlocks}
            loading={blocksLoading}
            collapsed={paletteCollapsed}
            onToggleCollapsed={() => setPaletteCollapsed((current) => !current)}
            onAdd={handlePaletteAdd}
          />
          <EditorCanvas
            nodes={nodes}
            device="desktop"
            siteSlug={null}
            blocksByErc={blocksByErc}
            selectedKey={selectedKey}
            dropTarget={dropTarget}
            onSelect={setSelectedKey}
            onSetProp={(key, propName, value) => setNodes(setNodeProp(nodes, key, propName, value))}
            onMove={(key, direction) => setNodes(moveNode(nodes, key, direction))}
            onDuplicate={handleDuplicate}
            onRemove={handleRemove}
            onOpenPicker={setInsertTarget}
          />
          <div className={classes.inspector}>
            {serverError ? (
              <Alert
                color="red"
                icon={<IconAlertCircle size={16} />}
                title="The template could not be saved"
                m="md"
              >
                <Text size="sm">{serverError.message}</Text>
              </Alert>
            ) : null}
            <TemplateInspector
              kind={kind}
              selectedNode={selectedNode}
              block={selectedBlock}
              blocksLoading={blocksLoading}
              tokens={tokens}
              onSetProp={(key, propName, value) =>
                setNodes(setNodeProp(nodes, key, propName, value))
              }
              onSetProps={(key, props) => setNodes(setNodeProps(nodes, key, props))}
              onSetStyle={(key, styleName, value) =>
                setNodes(setNodeStyle(nodes, key, styleName, value))
              }
            />
          </div>
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
        blocks={paletteBlocks}
        loading={blocksLoading}
        onPick={handlePick}
      />
    </div>
  );
}
