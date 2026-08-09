// Pure helpers converting between the page tree (spec 03) and the visual
// editor state. Editor nodes carry a stable key so React lists and targeted
// immutable updates (move, remove, set prop) stay simple. No React in here;
// every exported function takes state in and returns new state.

import type { PageTree, TreeNode } from './tree-utils';

export interface EditorNode {
  key: string;
  block: string;
  props: Record<string, unknown>;
  slots: Record<string, EditorNode[]>;
}

// Root insert when null, otherwise a named slot of an existing node.
export type InsertLocation = { parentKey: string; slot: string } | null;

let keyCounter = 0;

function nextKey(): string {
  keyCounter += 1;
  return `node-${keyCounter}`;
}

export function treeToState(tree: PageTree): EditorNode[] {
  return tree.blocks.map(nodeToEditor);
}

function nodeToEditor(node: TreeNode): EditorNode {
  const slots: Record<string, EditorNode[]> = {};
  for (const [name, children] of Object.entries(node.slots ?? {})) {
    slots[name] = children.map(nodeToEditor);
  }
  return { key: nextKey(), block: node.block, props: { ...(node.props ?? {}) }, slots };
}

export function stateToTree(nodes: EditorNode[]): PageTree {
  return { blocks: nodes.map(editorToNode) };
}

function editorToNode(node: EditorNode): TreeNode {
  const result: TreeNode = { block: node.block, props: node.props };
  const slotEntries = Object.entries(node.slots);
  if (slotEntries.length > 0) {
    const slots: Record<string, TreeNode[]> = {};
    for (const [name, children] of slotEntries) {
      slots[name] = children.map(editorToNode);
    }
    result.slots = slots;
  }
  return result;
}

export function insertNode(
  nodes: EditorNode[],
  location: InsertLocation,
  blockErc: string,
): { nodes: EditorNode[]; key: string } {
  const created: EditorNode = { key: nextKey(), block: blockErc, props: {}, slots: {} };
  if (location === null) {
    return { nodes: [...nodes, created], key: created.key };
  }
  const next = mapNode(nodes, location.parentKey, (node) => ({
    ...node,
    slots: {
      ...node.slots,
      [location.slot]: [...(node.slots[location.slot] ?? []), created],
    },
  }));
  return { nodes: next, key: created.key };
}

export function removeNode(nodes: EditorNode[], key: string): EditorNode[] {
  return nodes
    .filter((node) => node.key !== key)
    .map((node) => ({
      ...node,
      slots: mapSlots(node.slots, (children) => removeNode(children, key)),
    }));
}

// Moves a node one position among its siblings; no-op at the edges.
export function moveNode(nodes: EditorNode[], key: string, direction: 'up' | 'down'): EditorNode[] {
  const index = nodes.findIndex((node) => node.key === key);
  if (index !== -1) {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= nodes.length) {
      return nodes;
    }
    const copy = [...nodes];
    const moved = copy[index];
    const other = copy[target];
    if (moved === undefined || other === undefined) {
      return nodes;
    }
    copy[index] = other;
    copy[target] = moved;
    return copy;
  }
  return nodes.map((node) => ({
    ...node,
    slots: mapSlots(node.slots, (children) => moveNode(children, key, direction)),
  }));
}

// Reorders a node among its siblings so it lands at the position of the node
// with overKey. Only acts when both keys live in the same list (root or one
// slot); any other combination is a no-op, which makes drag-and-drop safe
// against cross-container drops the editor does not support.
export function reorderNodes(
  nodes: EditorNode[],
  activeKey: string,
  overKey: string,
): EditorNode[] {
  const from = nodes.findIndex((node) => node.key === activeKey);
  const to = nodes.findIndex((node) => node.key === overKey);
  if (from !== -1 && to !== -1 && from !== to) {
    const copy = [...nodes];
    const [moved] = copy.splice(from, 1);
    if (moved === undefined) {
      return nodes;
    }
    copy.splice(to, 0, moved);
    return copy;
  }
  return nodes.map((node) => ({
    ...node,
    slots: mapSlots(node.slots, (children) => reorderNodes(children, activeKey, overKey)),
  }));
}

// Inserts a new root-level node at a specific index (used by palette drops).
export function insertRootNodeAt(
  nodes: EditorNode[],
  index: number,
  blockErc: string,
): { nodes: EditorNode[]; key: string } {
  const created: EditorNode = { key: nextKey(), block: blockErc, props: {}, slots: {} };
  const at = Math.max(0, Math.min(index, nodes.length));
  return { nodes: [...nodes.slice(0, at), created, ...nodes.slice(at)], key: created.key };
}

// Sets one prop value; undefined removes the prop entirely.
export function setNodeProp(
  nodes: EditorNode[],
  key: string,
  name: string,
  value: unknown,
): EditorNode[] {
  return mapNode(nodes, key, (node) => {
    const props = { ...node.props };
    if (value === undefined) {
      delete props[name];
    } else {
      props[name] = value;
    }
    return { ...node, props };
  });
}

export function setNodeProps(
  nodes: EditorNode[],
  key: string,
  props: Record<string, unknown>,
): EditorNode[] {
  return mapNode(nodes, key, (node) => ({ ...node, props }));
}

function mapNode(
  nodes: EditorNode[],
  key: string,
  update: (node: EditorNode) => EditorNode,
): EditorNode[] {
  return nodes.map((node) => {
    if (node.key === key) {
      return update(node);
    }
    return { ...node, slots: mapSlots(node.slots, (children) => mapNode(children, key, update)) };
  });
}

function mapSlots(
  slots: Record<string, EditorNode[]>,
  update: (children: EditorNode[]) => EditorNode[],
): Record<string, EditorNode[]> {
  const result: Record<string, EditorNode[]> = {};
  for (const [name, children] of Object.entries(slots)) {
    result[name] = update(children);
  }
  return result;
}
