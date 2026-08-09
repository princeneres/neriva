// Pure helpers for the page tree: JSON parsing plus a light shape check
// mirroring the tree shape from spec 03. Full validation (block existence,
// slot names, props schemas) stays on the server.

export const PATH_PATTERN = /^\/[a-z0-9/-]*$/;

// props and slots are optional server-side; a headless client may store
// nodes carrying only "block".
export interface TreeNode {
  block: string;
  props?: Record<string, unknown>;
  slots?: Record<string, TreeNode[]>;
}

export interface PageTree {
  blocks: TreeNode[];
}

export type ParseTreeResult = { ok: true; tree: PageTree } | { ok: false; error: string };

export function isPlainObject(value: unknown): value is Record<string, unknown> {
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
  if (node.props !== undefined && !isPlainObject(node.props)) {
    return `${pointer}: "props" must be an object.`;
  }
  if (node.slots !== undefined && !isPlainObject(node.slots)) {
    return `${pointer}: "slots" must be an object mapping slot names to arrays.`;
  }
  for (const [slotName, children] of Object.entries(
    (node.slots as Record<string, unknown> | undefined) ?? {},
  )) {
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
