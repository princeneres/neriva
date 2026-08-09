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
  styles: Record<string, string>;
}

// The root list when null, otherwise a named slot of an existing node.
export type ContainerRef = { parentKey: string; slot: string } | null;

// Root insert when null, otherwise a named slot of an existing node.
export type InsertLocation = ContainerRef;

// Stable string identity for a container, used to match drop indicators.
export function containerKey(container: ContainerRef): string {
  return container === null ? 'root' : `${container.parentKey}/${container.slot}`;
}

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
  const styles: Record<string, string> = {};
  for (const [name, value] of Object.entries(node.styles ?? {})) {
    if (typeof value === 'string') {
      styles[name] = value;
    }
  }
  return { key: nextKey(), block: node.block, props: { ...(node.props ?? {}) }, slots, styles };
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
  if (Object.keys(node.styles).length > 0) {
    result.styles = { ...node.styles };
  }
  return result;
}

function createNode(blockErc: string): EditorNode {
  return { key: nextKey(), block: blockErc, props: {}, slots: {}, styles: {} };
}

export function insertNode(
  nodes: EditorNode[],
  location: InsertLocation,
  blockErc: string,
): { nodes: EditorNode[]; key: string } {
  const created = createNode(blockErc);
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

export function findNode(nodes: EditorNode[], key: string): EditorNode | null {
  for (const node of nodes) {
    if (node.key === key) {
      return node;
    }
    for (const children of Object.values(node.slots)) {
      const found = findNode(children, key);
      if (found !== null) {
        return found;
      }
    }
  }
  return null;
}

// Deep-copies a node (fresh keys throughout) and places the copy right after
// the original among its siblings. Returns the copy's key for selection.
export function duplicateNode(
  nodes: EditorNode[],
  key: string,
): { nodes: EditorNode[]; key: string | null } {
  const index = nodes.findIndex((node) => node.key === key);
  if (index !== -1) {
    const source = nodes[index];
    if (source === undefined) {
      return { nodes, key: null };
    }
    const copy = cloneWithFreshKeys(source);
    return {
      nodes: [...nodes.slice(0, index + 1), copy, ...nodes.slice(index + 1)],
      key: copy.key,
    };
  }
  let createdKey: string | null = null;
  const next = nodes.map((node) => ({
    ...node,
    slots: mapSlots(node.slots, (children) => {
      const result = duplicateNode(children, key);
      if (result.key !== null) {
        createdKey = result.key;
      }
      return result.nodes;
    }),
  }));
  return createdKey === null ? { nodes, key: null } : { nodes: next, key: createdKey };
}

function cloneWithFreshKeys(node: EditorNode): EditorNode {
  const slots: Record<string, EditorNode[]> = {};
  for (const [name, children] of Object.entries(node.slots)) {
    slots[name] = children.map(cloneWithFreshKeys);
  }
  return {
    key: nextKey(),
    block: node.block,
    props: { ...node.props },
    slots,
    styles: { ...node.styles },
  };
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

// Inserts a new node at a specific index of a container (palette drops).
export function insertNodeAt(
  nodes: EditorNode[],
  container: ContainerRef,
  index: number,
  blockErc: string,
): { nodes: EditorNode[]; key: string } {
  const created = createNode(blockErc);
  if (container === null) {
    const at = clampIndex(index, nodes.length);
    return { nodes: [...nodes.slice(0, at), created, ...nodes.slice(at)], key: created.key };
  }
  const next = mapNode(nodes, container.parentKey, (parent) => {
    const children = parent.slots[container.slot] ?? [];
    const at = clampIndex(index, children.length);
    return {
      ...parent,
      slots: {
        ...parent.slots,
        [container.slot]: [...children.slice(0, at), created, ...children.slice(at)],
      },
    };
  });
  return { nodes: next, key: created.key };
}

// Locates the container (root or slot) holding a node and its index in it.
export function findNodeContainer(
  nodes: EditorNode[],
  key: string,
): { container: ContainerRef; index: number } | null {
  const rootIndex = nodes.findIndex((node) => node.key === key);
  if (rootIndex !== -1) {
    return { container: null, index: rootIndex };
  }
  return findInSlots(nodes, key);
}

function findInSlots(
  nodes: EditorNode[],
  key: string,
): { container: ContainerRef; index: number } | null {
  for (const node of nodes) {
    for (const [slot, children] of Object.entries(node.slots)) {
      const index = children.findIndex((child) => child.key === key);
      if (index !== -1) {
        return { container: { parentKey: node.key, slot }, index };
      }
      const nested = findInSlots(children, key);
      if (nested !== null) {
        return nested;
      }
    }
  }
  return null;
}

function sameContainer(a: ContainerRef, b: ContainerRef): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  return a.parentKey === b.parentKey && a.slot === b.slot;
}

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(index, length));
}

// Moves an existing node to any position of any container (fluid drag and
// drop). The index refers to the list BEFORE the node is lifted out; moving
// down within the same container compensates for the removal shift. No-ops:
// unknown node, unknown target parent, or a drop into the node itself or one
// of its descendants.
export function moveNodeToContainer(
  nodes: EditorNode[],
  nodeKey: string,
  container: ContainerRef,
  index: number,
): EditorNode[] {
  const node = findNode(nodes, nodeKey);
  const source = findNodeContainer(nodes, nodeKey);
  if (node === null || source === null) {
    return nodes;
  }
  if (container !== null) {
    // findNode over [node] matches the node itself and every descendant.
    if (findNode([node], container.parentKey) !== null) {
      return nodes;
    }
    if (findNode(nodes, container.parentKey) === null) {
      return nodes;
    }
  }
  let at = index;
  if (sameContainer(source.container, container) && source.index < at) {
    at -= 1;
  }
  const without = removeNode(nodes, nodeKey);
  if (container === null) {
    const clamped = clampIndex(at, without.length);
    return [...without.slice(0, clamped), node, ...without.slice(clamped)];
  }
  return mapNode(without, container.parentKey, (parent) => {
    const children = parent.slots[container.slot] ?? [];
    const clamped = clampIndex(at, children.length);
    return {
      ...parent,
      slots: {
        ...parent.slots,
        [container.slot]: [...children.slice(0, clamped), node, ...children.slice(clamped)],
      },
    };
  });
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

// Sets one style value; undefined or a blank string removes the key so
// cleared controls fall back to the block and style book defaults.
export function setNodeStyle(
  nodes: EditorNode[],
  key: string,
  name: string,
  value: string | undefined,
): EditorNode[] {
  return mapNode(nodes, key, (node) => {
    const styles = { ...node.styles };
    if (value === undefined || value.trim() === '') {
      delete styles[name];
    } else {
      styles[name] = value;
    }
    return { ...node, styles };
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
