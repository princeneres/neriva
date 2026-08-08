// Pure helpers for the page tree editor: JSON parsing plus a light shape
// check mirroring the tree shape from spec 03. Full validation (block
// existence, slot names, props schemas) stays on the server.

export const PATH_PATTERN = /^\/[a-z0-9/-]*$/;

export interface TreeNode {
  block: string;
  props: Record<string, unknown>;
  slots: Record<string, TreeNode[]>;
}

export interface PageTree {
  blocks: TreeNode[];
}

export type ParseTreeResult = { ok: true; tree: PageTree } | { ok: false; error: string };

export type InsertBlockResult = { ok: true; text: string } | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Returns an error message with a node pointer (e.g. blocks[0].slots.main[2])
// matching the pointers the API uses, or null when the node is well-shaped.
function checkNode(node: unknown, pointer: string): string | null {
  if (!isPlainObject(node)) {
    return `${pointer}: node must be an object.`;
  }
  if (typeof node.block !== 'string' || node.block.trim() === '') {
    return `${pointer}: "block" must be a non-empty string (a block ERC).`;
  }
  if (!isPlainObject(node.props)) {
    return `${pointer}: "props" must be an object.`;
  }
  if (!isPlainObject(node.slots)) {
    return `${pointer}: "slots" must be an object mapping slot names to arrays.`;
  }
  for (const [slotName, children] of Object.entries(node.slots)) {
    if (!Array.isArray(children)) {
      return `${pointer}.slots.${slotName}: slot value must be an array of nodes.`;
    }
    for (let index = 0; index < children.length; index += 1) {
      const childError = checkNode(children[index], `${pointer}.slots.${slotName}[${index}]`);
      if (childError !== null) {
        return childError;
      }
    }
  }
  return null;
}

export function parseTree(text: string): ParseTreeResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      error: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  if (!isPlainObject(value)) {
    return { ok: false, error: 'Tree must be a JSON object.' };
  }
  if (!Array.isArray(value.blocks)) {
    return { ok: false, error: 'Tree root must have a "blocks" array.' };
  }
  for (let index = 0; index < value.blocks.length; index += 1) {
    const nodeError = checkNode(value.blocks[index], `blocks[${index}]`);
    if (nodeError !== null) {
      return { ok: false, error: nodeError };
    }
  }
  // The shape was verified above; narrow the parsed value to PageTree.
  return { ok: true, tree: value as unknown as PageTree };
}

export function stringifyTree(tree: unknown): string {
  return JSON.stringify(tree, null, 2);
}

export const EMPTY_TREE_TEXT = stringifyTree({ blocks: [] });

// Appends an empty instance of the given block ERC to the root blocks array
// of the current editor text. Only requires the text to parse and have a
// root blocks array; node-level problems are reported on submit instead.
export function insertBlock(text: string, erc: string): InsertBlockResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: 'The current tree is not valid JSON. Fix it before inserting.' };
  }
  if (!isPlainObject(value) || !Array.isArray(value.blocks)) {
    return { ok: false, error: 'Tree root must be an object with a "blocks" array.' };
  }
  value.blocks.push({ block: erc, props: {}, slots: {} });
  return { ok: true, text: stringifyTree(value) };
}
