'use client';

import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  ActionIcon,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconArrowDown,
  IconArrowUp,
  IconCopy,
  IconCube,
  IconGripVertical,
  IconPencil,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import {
  type CSSProperties,
  Fragment,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { rendererFor } from '../../../lib/renderer/registry';
import { scopeSiteCss, SITE_CSS_SCOPE_CLASS } from '../../../lib/renderer/scope-css';
import {
  type NavPage,
  renderTemplate,
  resolveStyles,
  sanitizeRich,
} from '../../../lib/renderer/template';
import { renderTemplateNodes } from '../../../lib/renderer/template-nodes';
import { type ContainerRef, containerKey, type EditorNode } from './editor-state';
import classes from './studio.module.css';
import { useSitePreviewData } from './use-site-preview-data';
import type { Block } from './types';

// Where the block picker inserts: a root position or a named slot.
export type InsertTarget =
  { kind: 'root'; index: number } | { kind: 'slot'; parentKey: string; slot: string };

export const ROOT_DROP_ID = 'studio-root-canvas';

export type CanvasDevice = 'desktop' | 'tablet' | 'mobile';

// Where a drag would drop right now: a container identity plus the insertion
// index in it, matched by each container to draw the indicator line.
export interface DropTarget {
  containerKey: string;
  index: number;
}

// Payload carried by every canvas droppable; page-studio reads it to resolve
// the drop position without parsing droppable ids.
export type CanvasDropData =
  | { kind: 'node'; key: string; container: ContainerRef; index: number }
  | { kind: 'container'; container: ContainerRef };

const DEVICE_WIDTHS: Record<CanvasDevice, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '390px',
};

interface CanvasContext {
  blocksByErc: Map<string, Block>;
  selectedKey: string | null;
  dropTarget: DropTarget | null;
  onSelect: (key: string | null) => void;
  onSetProp: (key: string, name: string, value: unknown) => void;
  onMove: (key: string, direction: 'up' | 'down') => void;
  onDuplicate: (key: string) => void;
  onRemove: (key: string) => void;
  onOpenPicker: (target: InsertTarget) => void;
}

// CanvasContext plus the site's published pages, fetched by EditorCanvas
// itself (like the preview stylesheet) and threaded down to template blocks
// so header/footer nav (data-nv-nav="pages") renders real links in the studio.
interface CanvasContextWithNav extends CanvasContext {
  sitePages: NavPage[];
  // Also threaded down so the data-driven registry blocks read the site being
  // edited, exactly as they do on the published page.
  siteSlug: string | null;
}

// The WYSIWYG canvas: the page rendered the same way the public runtime
// renders it (template engine for template blocks, registry otherwise), with
// every block wrapped in a selection frame. The site's public stylesheet is
// fetched and scoped to the surface so the canvas matches the live site.
export function EditorCanvas({
  nodes,
  device,
  siteSlug,
  ...ctx
}: CanvasContext & {
  nodes: EditorNode[];
  device: CanvasDevice;
  siteSlug: string | null;
}) {
  const { css, sitePages } = useSitePreviewData(siteSlug);
  const { setNodeRef } = useDroppable({
    id: ROOT_DROP_ID,
    data: { kind: 'container', container: null } satisfies CanvasDropData,
  });

  const canvasCtx: CanvasContextWithNav = { ...ctx, sitePages, siteSlug };

  const scopedCss = useMemo(() => scopeSiteCss(css), [css]);

  const rootDropIndex =
    ctx.dropTarget !== null && ctx.dropTarget.containerKey === containerKey(null)
      ? ctx.dropTarget.index
      : null;

  return (
    <div className={classes.canvasScroll}>
      <div
        ref={setNodeRef}
        // nv-site-root: the dark-mode rules renderTokensCss emits are scoped
        // to it and to :root, and :root is rewritten onto the scope class,
        // so both resolve against this element.
        className={`${classes.pageSurface} ${SITE_CSS_SCOPE_CLASS} nv-site-root`}
        // Explicit, because the rewritten prefers-color-scheme rule reads
        // :not([data-nv-theme='light']): without the stamp the canvas would
        // follow the editor's OS theme instead of the page being edited.
        data-nv-theme="light"
        style={{ maxWidth: DEVICE_WIDTHS[device] }}
        onClick={() => ctx.onSelect(null)}
      >
        {scopedCss !== '' ? <style>{scopedCss}</style> : null}
        {nodes.length === 0 ? (
          <>
            {rootDropIndex !== null ? <div className={classes.dropLine} /> : null}
            <EmptyCanvas onAdd={() => ctx.onOpenPicker({ kind: 'root', index: 0 })} />
          </>
        ) : (
          <>
            {nodes.map((node, index) => (
              <Fragment key={node.key}>
                <InsertZone
                  index={index}
                  onOpen={(at) => ctx.onOpenPicker({ kind: 'root', index: at })}
                />
                {rootDropIndex === index ? <div className={classes.dropLine} /> : null}
                <BlockFrame
                  node={node}
                  container={null}
                  index={index}
                  count={nodes.length}
                  ctx={canvasCtx}
                />
              </Fragment>
            ))}
            {rootDropIndex === nodes.length ? <div className={classes.dropLine} /> : null}
            <button
              type="button"
              className={classes.addArea}
              onClick={(event) => {
                event.stopPropagation();
                ctx.onOpenPicker({ kind: 'root', index: nodes.length });
              }}
            >
              <IconPlus size={15} />
              Add block
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyCanvas({ onAdd }: { onAdd: () => void }) {
  return (
    <Stack align="center" gap="sm" py={80} px="md">
      <ThemeIcon size={44} radius="xl" variant="light">
        <IconCube size={22} stroke={1.6} />
      </ThemeIcon>
      <Text fw={600}>This page is empty</Text>
      <Text size="sm" c="slate.5" ta="center" maw={400}>
        Pages are built by stacking blocks from top to bottom. Click a block in the palette on the
        left, or add your first one here.
      </Text>
      <Button
        leftSection={<IconPlus size={16} />}
        onClick={(event) => {
          event.stopPropagation();
          onAdd();
        }}
      >
        Add your first block
      </Button>
    </Stack>
  );
}

// Thin hover-revealed insertion line between root blocks.
function InsertZone({ index, onOpen }: { index: number; onOpen: (index: number) => void }) {
  return (
    <div className={classes.insertZone}>
      <button
        type="button"
        className={classes.insertButton}
        aria-label="Insert a block here"
        onClick={(event) => {
          event.stopPropagation();
          onOpen(index);
        }}
      >
        <IconPlus size={13} />
      </button>
    </div>
  );
}

// The selection wrapper around one rendered block, anywhere in the tree. It
// is a drag source (grip only) and a drop target carrying its container and
// position. Click (bubble phase, so the innermost frame wins) selects; a
// capture-phase preventDefault keeps rendered links and buttons from
// navigating inside the editor.
function BlockFrame({
  node,
  container,
  index,
  count,
  ctx,
}: {
  node: EditorNode;
  container: ContainerRef;
  index: number;
  count: number;
  ctx: CanvasContextWithNav;
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({ id: node.key });
  const { setNodeRef: setDropRef } = useDroppable({
    id: `drop:${node.key}`,
    data: { kind: 'node', key: node.key, container, index } satisfies CanvasDropData,
  });

  const block = ctx.blocksByErc.get(node.block) ?? null;
  const selected = ctx.selectedKey === node.key;
  const name = block?.name ?? node.block;

  const slotNames = [
    ...new Set([...(block?.slots.map((slot) => slot.name) ?? []), ...Object.keys(node.slots)]),
  ];
  const slots: Record<string, ReactNode> = {};
  for (const slotName of slotNames) {
    slots[slotName] = (
      <SlotArea
        key={slotName}
        parentKey={node.key}
        slotName={slotName}
        nodes={node.slots[slotName] ?? []}
        ctx={ctx}
      />
    );
  }

  const template = typeof block?.html === 'string' && block.html.trim() !== '' ? block.html : null;
  let content: ReactNode;
  if (block !== null && template !== null) {
    content = (
      <TemplateContent
        node={node}
        html={template}
        css={typeof block.css === 'string' ? block.css : null}
        block={block}
        slots={slots}
        editable={selected}
        onSetProp={ctx.onSetProp}
        sitePages={ctx.sitePages}
      />
    );
  } else {
    const Renderer = rendererFor(node.block);
    content = (
      <Renderer
        props={node.props}
        slots={slots}
        blockName={name}
        siteSlug={ctx.siteSlug ?? undefined}
      />
    );
  }

  // Same wrapper rule as RenderTree: per-instance styles land on a div around
  // the block's content so the canvas matches the published page.
  const nodeStyles = resolveStyles(node.styles);
  if (Object.keys(nodeStyles).length > 0) {
    content = <div style={nodeStyles as CSSProperties}>{content}</div>;
  }

  return (
    <div
      ref={(element) => {
        setDragRef(element);
        setDropRef(element);
      }}
      className={selected ? `${classes.block} ${classes.blockSelected}` : classes.block}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      onClickCapture={(event) => event.preventDefault()}
      onClick={(event) => {
        event.stopPropagation();
        ctx.onSelect(node.key);
      }}
    >
      <span className={classes.chip}>{name}</span>
      {selected ? (
        <MiniToolbar
          nodeKey={node.key}
          index={index}
          count={count}
          ctx={ctx}
          dragHandle={{ ...attributes, ...listeners }}
        />
      ) : null}
      {content}
    </div>
  );
}

// One html segment of a rendered template, managed imperatively so inline
// editing works: React writes the markup once, then this component re-applies
// innerHTML only when the html actually changed AND the user is not typing in
// one of the bound elements (their input is what changed the state, so the
// DOM is already up to date; rewriting it would destroy the caret).
function EditableHtml({
  html,
  editable,
  onEdit,
}: {
  html: string;
  editable: boolean;
  onEdit: (kind: 'text' | 'rich', propKey: string, element: HTMLElement) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const appliedHtml = useRef<string | null>(null);
  const onEditRef = useRef(onEdit);
  onEditRef.current = onEdit;

  // This effect owns the markup, not React: with dangerouslySetInnerHTML,
  // React wrote the stale initial markup back on later renders and undid prop
  // edits made from the inspector.
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }
    if (appliedHtml.current !== html) {
      const active = document.activeElement;
      const editingHere =
        appliedHtml.current !== null &&
        active instanceof HTMLElement &&
        active.isContentEditable &&
        element.contains(active);
      appliedHtml.current = html;
      if (!editingHere) {
        element.innerHTML = html;
      }
    }
    for (const target of element.querySelectorAll<HTMLElement>('[data-nv-text], [data-nv-rich]')) {
      if (!editable) {
        target.removeAttribute('contenteditable');
        continue;
      }
      if (target.hasAttribute('contenteditable')) {
        continue;
      }
      if (target.hasAttribute('data-nv-text')) {
        target.setAttribute('contenteditable', 'plaintext-only');
        if (!target.isContentEditable) {
          // Fallback for engines without plaintext-only support.
          target.setAttribute('contenteditable', 'true');
        }
      } else {
        target.setAttribute('contenteditable', 'true');
      }
    }
  }, [html, editable]);

  // One delegated listener survives innerHTML replacement.
  useEffect(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }
    const handler = (event: Event) => {
      if (!(event.target instanceof HTMLElement)) {
        return;
      }
      const host = event.target.closest<HTMLElement>('[data-nv-text], [data-nv-rich]');
      if (host === null || !element.contains(host)) {
        return;
      }
      const textKey = host.getAttribute('data-nv-text');
      if (textKey !== null && textKey !== '') {
        onEditRef.current('text', textKey, host);
        return;
      }
      const richKey = host.getAttribute('data-nv-rich');
      if (richKey !== null && richKey !== '') {
        onEditRef.current('rich', richKey, host);
      }
    };
    element.addEventListener('input', handler);
    return () => element.removeEventListener('input', handler);
  }, []);

  return <div ref={ref} style={{ display: 'contents' }} />;
}

interface ImageTarget {
  propKey: string;
  top: number;
  left: number;
}

// A template block's rendered content: html segments interleaved with slot
// areas, plus the inline-editing hooks (contentEditable bindings and the
// image URL overlay) when the block is selected.
function TemplateContent({
  node,
  html,
  css,
  block,
  slots,
  editable,
  onSetProp,
  sitePages,
}: {
  node: EditorNode;
  html: string;
  css: string | null;
  block: Block;
  slots: Record<string, ReactNode>;
  editable: boolean;
  onSetProp: (key: string, name: string, value: unknown) => void;
  sitePages: NavPage[];
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [imageTargets, setImageTargets] = useState<ImageTarget[]>([]);
  const [imagePropKey, setImagePropKey] = useState<string | null>(null);

  const declaredSlots = useMemo(() => block.slots.map((slot) => slot.name), [block]);
  const { nodes, css: scopedCss } = useMemo(
    () =>
      renderTemplate({
        html,
        css,
        erc: node.block,
        props: node.props,
        slots: declaredSlots,
        sitePages,
      }),
    [html, css, node.block, node.props, declaredSlots, sitePages],
  );

  // Overlay buttons for image bindings, positioned over each bound element.
  // Best-effort: recomputed when the selection or the rendered html changes.
  useEffect(() => {
    if (!editable) {
      setImageTargets([]);
      return;
    }
    const wrapper = wrapperRef.current;
    if (wrapper === null) {
      return;
    }
    const base = wrapper.getBoundingClientRect();
    const targets: ImageTarget[] = [];
    for (const element of wrapper.querySelectorAll<HTMLElement>('[data-nv-image]')) {
      // Skip bindings that belong to nested blocks rendered inside slots.
      if (element.closest('[data-nv-b]') !== wrapper) {
        continue;
      }
      const propKey = element.getAttribute('data-nv-image');
      if (propKey === null || propKey === '') {
        continue;
      }
      const rect = element.getBoundingClientRect();
      targets.push({ propKey, top: rect.top - base.top + 6, left: rect.left - base.left + 6 });
    }
    setImageTargets(targets);
  }, [editable, nodes]);

  const imageValue =
    imagePropKey !== null && typeof node.props[imagePropKey] === 'string'
      ? (node.props[imagePropKey] as string)
      : '';

  return (
    <>
      {scopedCss !== '' ? (
        // scopeCss escapes "</" so the css cannot close the style element.
        <style dangerouslySetInnerHTML={{ __html: scopedCss }} />
      ) : null}
      <div data-nv-b={node.block} ref={wrapperRef} style={{ position: 'relative' }}>
        {renderTemplateNodes(nodes, slots, (html, key) => (
          <EditableHtml
            key={key}
            html={html}
            editable={editable}
            onEdit={(kind, propKey, element) => {
              const value =
                kind === 'text' ? (element.textContent ?? '') : sanitizeRich(element.innerHTML);
              onSetProp(node.key, propKey, value);
            }}
          />
        ))}
        {imageTargets.map((target) => (
          <Tooltip label="Change image" key={target.propKey}>
            <ActionIcon
              size="sm"
              variant="filled"
              aria-label="Change image"
              style={{ position: 'absolute', top: target.top, left: target.left, zIndex: 8 }}
              onClick={(event) => {
                event.stopPropagation();
                setImagePropKey(target.propKey);
              }}
            >
              <IconPencil size={14} />
            </ActionIcon>
          </Tooltip>
        ))}
      </div>
      <Modal
        opened={imagePropKey !== null}
        onClose={() => setImagePropKey(null)}
        title="Image"
        size="md"
      >
        <Stack gap="sm">
          <TextInput
            label="Image URL"
            placeholder="https://example.com/picture.jpg"
            value={imageValue}
            data-autofocus
            onChange={(event) => {
              if (imagePropKey !== null) {
                const next = event.currentTarget.value;
                onSetProp(node.key, imagePropKey, next === '' ? undefined : next);
              }
            }}
          />
          <Text size="xs" c="slate.5">
            Paste a link to an image; the canvas updates as you type. Picking from the media library
            will arrive in a later update.
          </Text>
          <Group justify="flex-end">
            <Button size="xs" onClick={() => setImagePropKey(null)}>
              Done
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

function MiniToolbar({
  nodeKey,
  index,
  count,
  ctx,
  dragHandle,
}: {
  nodeKey: string;
  index: number;
  count: number;
  ctx: CanvasContext;
  dragHandle?: Record<string, unknown>;
}) {
  return (
    // Keep toolbar clicks from re-selecting or bubbling into the frame.
    <div className={classes.toolbar} onClick={(event) => event.stopPropagation()}>
      {dragHandle ? (
        <Tooltip label="Drag anywhere on the page">
          <button
            type="button"
            className={`${classes.toolbarButton} ${classes.grip}`}
            aria-label="Drag block to move it"
            {...dragHandle}
          >
            <IconGripVertical size={14} />
          </button>
        </Tooltip>
      ) : null}
      <Tooltip label="Move up">
        <button
          type="button"
          className={classes.toolbarButton}
          aria-label="Move block up"
          disabled={index === 0}
          onClick={() => ctx.onMove(nodeKey, 'up')}
        >
          <IconArrowUp size={14} />
        </button>
      </Tooltip>
      <Tooltip label="Move down">
        <button
          type="button"
          className={classes.toolbarButton}
          aria-label="Move block down"
          disabled={index === count - 1}
          onClick={() => ctx.onMove(nodeKey, 'down')}
        >
          <IconArrowDown size={14} />
        </button>
      </Tooltip>
      <Tooltip label="Duplicate">
        <button
          type="button"
          className={classes.toolbarButton}
          aria-label="Duplicate block"
          onClick={() => ctx.onDuplicate(nodeKey)}
        >
          <IconCopy size={14} />
        </button>
      </Tooltip>
      <Tooltip label="Remove">
        <button
          type="button"
          className={classes.toolbarButton}
          aria-label="Remove block"
          onClick={() => ctx.onRemove(nodeKey)}
        >
          <IconTrash size={14} />
        </button>
      </Tooltip>
    </div>
  );
}

// A slot rendered inside its parent block: a droppable container of
// edit-wrapped children followed by a dashed add button; empty slots show a
// labeled dashed drop area.
function SlotArea({
  parentKey,
  slotName,
  nodes,
  ctx,
}: {
  parentKey: string;
  slotName: string;
  nodes: EditorNode[];
  ctx: CanvasContextWithNav;
}) {
  const container: ContainerRef = { parentKey, slot: slotName };
  const { setNodeRef } = useDroppable({
    id: `container:${parentKey}:${slotName}`,
    data: { kind: 'container', container } satisfies CanvasDropData,
  });
  const dropIndex =
    ctx.dropTarget !== null && ctx.dropTarget.containerKey === containerKey(container)
      ? ctx.dropTarget.index
      : null;

  function open(event: MouseEvent) {
    event.stopPropagation();
    ctx.onOpenPicker({ kind: 'slot', parentKey, slot: slotName });
  }

  if (nodes.length === 0) {
    return (
      <button
        ref={setNodeRef}
        type="button"
        className={
          dropIndex !== null ? `${classes.slotEmpty} ${classes.slotDropActive}` : classes.slotEmpty
        }
        onClick={open}
      >
        <span className={classes.slotLabel}>{slotName}</span>
        <span>+ Add block</span>
      </button>
    );
  }
  return (
    <div ref={setNodeRef} className={classes.slotArea}>
      {nodes.map((child, index) => (
        <Fragment key={child.key}>
          {dropIndex === index ? <div className={classes.dropLine} /> : null}
          <BlockFrame
            node={child}
            container={container}
            index={index}
            count={nodes.length}
            ctx={ctx}
          />
        </Fragment>
      ))}
      {dropIndex === nodes.length ? <div className={classes.dropLine} /> : null}
      <button type="button" className={classes.slotAdd} onClick={open}>
        <IconPlus size={13} />
        Add to {slotName}
      </button>
    </div>
  );
}
