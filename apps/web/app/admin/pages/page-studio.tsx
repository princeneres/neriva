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
import { useMediaQuery } from '@mantine/hooks';
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
  IconEye,
  IconGripVertical,
  IconRocket,
  IconSettings,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, api } from '../../../lib/api';
import { BlockPickerModal } from './block-picker';
import {
  type CanvasDevice,
  type CanvasDropData,
  type DropTarget,
  EditorCanvas,
  type InsertTarget,
} from './editor-canvas';
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
} from './editor-state';
import { PagePreview } from './page-preview';
import { type PageMeta, StudioInspector } from './studio-inspector';
import { PALETTE_ID_PREFIX, StudioPalette } from './studio-palette';
import classes from './studio.module.css';
import { type PageTree, parseTree, stringifyTree } from './tree-utils';
import { type Block, type EntityStatus, statusColor } from './types';

export interface PageStudioValues {
  title: string;
  path: string;
  tree: PageTree;
}

type StyleBook = components['schemas']['StyleBookDto'];

// Below this the palette and the inspector stop sharing the row with the
// canvas and float above it instead (see studio.module.css). Kept in sync with
// the media query there by hand: CSS handles the layout, this flag only picks
// the starting state and whether the inspector is mounted as an overlay.
const NARROW_QUERY = '(max-width: 1080px)';

// The Page Studio: a WYSIWYG editor where the rendered page is the canvas.
// Left palette inserts blocks, clicking a block on the page selects it, the
// right inspector edits it live. This is edit mode only; page configuration
// (title, path, publishing) lives in the settings screen at settingsHref.
// All API calls stay in the route and flow in via onSave/onPublish.
export function PageStudio({
  initial,
  status,
  pageMeta,
  settingsHref,
  siteSlug,
  busy,
  serverError,
  viewUrl,
  onSave,
  onPublish,
}: {
  initial: { title: string; path: string; tree: PageTree };
  status: EntityStatus;
  pageMeta: PageMeta;
  settingsHref: string;
  siteSlug: string | null;
  busy: boolean;
  serverError: ApiError | null;
  viewUrl: string | null;
  onSave: (values: PageStudioValues) => void;
  onPublish: () => void;
}) {
  const [nodes, setNodes] = useState<EditorNode[]>(() => treeToState(initial.tree));
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [device, setDevice] = useState<CanvasDevice>('desktop');
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  // undefined until the effect resolves the query, which keeps the server
  // render and the hydration pass agreeing on the wide layout.
  const narrow = useMediaQuery(NARROW_QUERY) ?? false;

  const [title, setTitle] = useState(initial.title);
  // The path is configured in the page settings; the studio only echoes it
  // back on save so PATCH payloads stay whole.
  const path = initial.path;
  const [titleError, setTitleError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);

  const [insertTarget, setInsertTarget] = useState<InsertTarget | null>(null);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [dragLabel, setDragLabel] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  // Kept alongside the DropTarget: the canvas matches by container key, while
  // the drop handlers need the structured container reference.
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

  // Style book tokens for the Styles tab: the most recently updated
  // PUBLISHED style book wins; none is fine (custom values still work).
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

  // On a narrow screen the palette starts as its rail so the canvas is visible
  // on arrival. Expanding it is still one click away, and it then floats over
  // the canvas rather than squeezing it.
  useEffect(() => {
    if (narrow) {
      setPaletteCollapsed(true);
    }
  }, [narrow]);

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

  // Map title validation messages from the server onto the top bar input;
  // everything else renders in the inspector Alert.
  useEffect(() => {
    if (!serverError) {
      return;
    }
    for (const message of serverError.problem.errors ?? []) {
      if (message.toLowerCase().startsWith('title')) {
        setTitleError(message);
      }
    }
  }, [serverError]);

  const blocksByErc = useMemo(
    () => new Map(blocks.map((block) => [block.externalReferenceCode, block])),
    [blocks],
  );
  const previewBlockInfo = useMemo(
    () =>
      Object.fromEntries(
        blocks.map((block) => [
          block.externalReferenceCode,
          { name: block.name, html: block.html, css: block.css, js: block.js, slots: block.slots },
        ]),
      ),
    [blocks],
  );
  const selectedNode = selectedKey === null ? null : findNode(nodes, selectedKey);
  const selectedBlock = selectedNode ? (blocksByErc.get(selectedNode.block) ?? null) : null;

  // A small distance threshold keeps plain clicks (select, palette add) working.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleSave() {
    if (title.trim() === '') {
      setTitleError('Give the page a title.');
      setEditingTitle(true);
      notifications.show({
        color: 'red',
        message: 'Give the page a title in the top bar first.',
      });
      return;
    }
    onSave({ title: title.trim(), path, tree: stateToTree(nodes) });
  }

  function confirmPublish() {
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

  function containerChildren(container: ContainerRef): EditorNode[] {
    if (container === null) {
      return nodes;
    }
    return findNode(nodes, container.parentKey)?.slots[container.slot] ?? [];
  }

  // Resolves where the dragged item would land right now: over a block frame
  // it drops before or after it (dragged rect center vs frame midpoint), over
  // a container it appends at the end. Null when the drop is invalid, e.g. a
  // block dragged into itself or one of its descendants.
  function resolveDropTarget(event: DragMoveEvent): {
    container: ContainerRef;
    index: number;
  } | null {
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
      // findNode over [dragged] matches the node itself and its descendants.
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

  if (previewMode) {
    return (
      <PagePreview
        title={title}
        siteSlug={siteSlug}
        tree={stateToTree(nodes)}
        blockInfo={previewBlockInfo}
        onExit={() => setPreviewMode(false)}
      />
    );
  }

  // Leaving the editor goes back to the page itself. A page with no public
  // address yet (draft, or a site with no known slug) has nowhere to go back
  // to, so it falls back to the pages list; settings has its own gear button.
  const backHref = viewUrl ?? '/admin/pages';
  const backLabel = viewUrl === null ? 'Back to pages' : 'Back to the page';

  return (
    <div className={classes.studio}>
      <div className={classes.topBar}>
        <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Tooltip label={backLabel}>
            <ActionIcon
              variant="subtle"
              color="slate"
              component={Link}
              href={backHref}
              aria-label={backLabel}
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
              error={titleError}
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
          <Badge color={statusColor(status)} style={{ flexShrink: 0 }}>
            {status}
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
          <Tooltip label="Preview how the page will look, without leaving the editor">
            <Button
              size="xs"
              variant="default"
              leftSection={<IconEye size={15} />}
              onClick={() => setPreviewMode(true)}
            >
              Preview
            </Button>
          </Tooltip>
          <Button size="xs" loading={busy} onClick={handleSave}>
            Save
          </Button>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconRocket size={15} />}
            disabled={busy}
            onClick={confirmPublish}
          >
            Publish
          </Button>
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
          <Tooltip label="Page settings: title, address and publishing">
            <ActionIcon
              variant="subtle"
              color="slate"
              component={Link}
              href={settingsHref}
              aria-label="Open the page settings"
            >
              <IconSettings size={18} />
            </ActionIcon>
          </Tooltip>
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
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
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
            dropTarget={dropTarget}
            onSelect={setSelectedKey}
            onSetProp={(key, name, value) => setNodes(setNodeProp(nodes, key, name, value))}
            onMove={(key, direction) => setNodes(moveNode(nodes, key, direction))}
            onDuplicate={handleDuplicate}
            onRemove={handleRemove}
            onOpenPicker={setInsertTarget}
          />
          {/* Wide screens ignore this wrapper (display: contents). Narrow ones
              turn it into a right-hand overlay that is only there when it has
              something to say: a selected block, or a save that failed. */}
          <div
            className={classes.inspectorDock}
            data-open={selectedNode !== null || serverError !== null ? 'true' : undefined}
          >
            <StudioInspector
              serverError={serverError}
              settingsHref={settingsHref}
              status={status}
              pageMeta={pageMeta}
              selectedNode={selectedNode}
              block={selectedBlock}
              blocksLoading={blocksLoading}
              tokens={tokens}
              onSetProp={(key, name, value) => setNodes(setNodeProp(nodes, key, name, value))}
              onSetProps={(key, props) => setNodes(setNodeProps(nodes, key, props))}
              onSetStyle={(key, name, value) => setNodes(setNodeStyle(nodes, key, name, value))}
              onDeselect={() => setSelectedKey(null)}
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
            canvas; nothing is saved until you use Save.
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
