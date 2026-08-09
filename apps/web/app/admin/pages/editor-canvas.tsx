'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Stack, Text, ThemeIcon, Tooltip } from '@mantine/core';
import {
  IconArrowDown,
  IconArrowUp,
  IconCopy,
  IconCube,
  IconGripVertical,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import {
  type CSSProperties,
  Fragment,
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { apiUrl } from '../../../lib/api-url';
import { rendererFor } from '../../../lib/renderer/registry';
import type { EditorNode } from './editor-state';
import classes from './studio.module.css';
import type { Block } from './types';

// Where the block picker inserts: a root position or a named slot.
export type InsertTarget =
  { kind: 'root'; index: number } | { kind: 'slot'; parentKey: string; slot: string };

export const ROOT_DROP_ID = 'studio-root-canvas';
const SCOPE_CLASS = 'nv-studio-canvas';

export type CanvasDevice = 'desktop' | 'tablet' | 'mobile';

const DEVICE_WIDTHS: Record<CanvasDevice, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '390px',
};

interface CanvasContext {
  blocksByErc: Map<string, Block>;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onMove: (key: string, direction: 'up' | 'down') => void;
  onDuplicate: (key: string) => void;
  onRemove: (key: string) => void;
  onOpenPicker: (target: InsertTarget) => void;
}

// The WYSIWYG canvas: the page rendered through the same block registry the
// public runtime uses, with every block wrapped in a selection frame. The
// site's public stylesheet is fetched and scoped to the surface so the canvas
// matches the live site.
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
  const [css, setCss] = useState('');
  const { setNodeRef } = useDroppable({ id: ROOT_DROP_ID });

  useEffect(() => {
    if (siteSlug === null || siteSlug === '') {
      return;
    }
    let cancelled = false;
    fetch(apiUrl(`/public/sites/${siteSlug}/style.css`))
      .then((response) => (response.ok ? response.text() : ''))
      .then((text) => {
        if (!cancelled) {
          setCss(text);
        }
      })
      .catch(() => {
        // No public style endpoint yet: render with the block defaults.
      });
    return () => {
      cancelled = true;
    };
  }, [siteSlug]);

  // The stylesheet declares tokens on :root; rewrite them onto the canvas
  // surface so they do not leak into the admin UI around it.
  const scopedCss = useMemo(() => css.replaceAll(':root', `.${SCOPE_CLASS}`), [css]);

  return (
    <div className={classes.canvasScroll}>
      <div
        ref={setNodeRef}
        className={`${classes.pageSurface} ${SCOPE_CLASS}`}
        style={{ maxWidth: DEVICE_WIDTHS[device] }}
        onClick={() => ctx.onSelect(null)}
      >
        {scopedCss !== '' ? <style>{scopedCss}</style> : null}
        {nodes.length === 0 ? (
          <EmptyCanvas onAdd={() => ctx.onOpenPicker({ kind: 'root', index: 0 })} />
        ) : (
          <>
            <SortableContext
              items={nodes.map((node) => node.key)}
              strategy={verticalListSortingStrategy}
            >
              {nodes.map((node, index) => (
                <Fragment key={node.key}>
                  <InsertZone
                    index={index}
                    onOpen={(at) => ctx.onOpenPicker({ kind: 'root', index: at })}
                  />
                  <SortableRootBlock node={node} index={index} count={nodes.length} ctx={ctx} />
                </Fragment>
              ))}
            </SortableContext>
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

// Root blocks are sortable: the grip in the mini-toolbar drags them.
function SortableRootBlock({
  node,
  index,
  count,
  ctx,
}: {
  node: EditorNode;
  index: number;
  count: number;
  ctx: CanvasContext;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.key,
  });
  return (
    <BlockFrame
      node={node}
      index={index}
      count={count}
      ctx={ctx}
      frameRef={setNodeRef}
      frameStyle={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
      dragHandle={{ ...attributes, ...listeners }}
    />
  );
}

// The selection wrapper around one rendered block. Click (bubble phase, so
// the innermost frame wins) selects; a capture-phase preventDefault keeps
// rendered links and buttons from navigating inside the editor.
function BlockFrame({
  node,
  index,
  count,
  ctx,
  frameRef,
  frameStyle,
  dragHandle,
}: {
  node: EditorNode;
  index: number;
  count: number;
  ctx: CanvasContext;
  frameRef?: Ref<HTMLDivElement>;
  frameStyle?: CSSProperties;
  dragHandle?: HTMLAttributes<HTMLButtonElement>;
}) {
  const block = ctx.blocksByErc.get(node.block) ?? null;
  const selected = ctx.selectedKey === node.key;
  const name = block?.name ?? node.block;
  const Renderer = rendererFor(node.block);

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

  return (
    <div
      ref={frameRef}
      className={selected ? `${classes.block} ${classes.blockSelected}` : classes.block}
      style={frameStyle}
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
          dragHandle={dragHandle}
        />
      ) : null}
      <Renderer props={node.props} slots={slots} blockName={name} />
    </div>
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
  dragHandle?: HTMLAttributes<HTMLButtonElement>;
}) {
  return (
    // Keep toolbar clicks from re-selecting or bubbling into the frame.
    <div className={classes.toolbar} onClick={(event) => event.stopPropagation()}>
      {dragHandle ? (
        <Tooltip label="Drag to reorder">
          <button
            type="button"
            className={`${classes.toolbarButton} ${classes.grip}`}
            aria-label="Drag block to reorder"
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

// A slot rendered inside its parent block: edit-wrapped children followed by
// a dashed add button; empty slots show a labeled dashed drop area.
function SlotArea({
  parentKey,
  slotName,
  nodes,
  ctx,
}: {
  parentKey: string;
  slotName: string;
  nodes: EditorNode[];
  ctx: CanvasContext;
}) {
  function open(event: MouseEvent) {
    event.stopPropagation();
    ctx.onOpenPicker({ kind: 'slot', parentKey, slot: slotName });
  }

  if (nodes.length === 0) {
    return (
      <button type="button" className={classes.slotEmpty} onClick={open}>
        <span className={classes.slotLabel}>{slotName}</span>
        <span>+ Add block</span>
      </button>
    );
  }
  return (
    <div className={classes.slotArea}>
      {nodes.map((child, index) => (
        <BlockFrame key={child.key} node={child} index={index} count={nodes.length} ctx={ctx} />
      ))}
      <button type="button" className={classes.slotAdd} onClick={open}>
        <IconPlus size={13} />
        Add to {slotName}
      </button>
    </div>
  );
}
