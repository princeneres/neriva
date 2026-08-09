import { Ajv2020 } from 'ajv/dist/2020';
import type { ValidateFunction } from 'ajv/dist/2020';
import type { BlockSlot, PageTree, PageTreeNode } from '../../db/schema';

// The subset of a block row the tree validator needs. Kept structural so the
// validator stays a pure function, decoupled from the database layer.
export interface BlockDefinition {
  externalReferenceCode: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  propsSchema: Record<string, unknown>;
  slots: BlockSlot[];
}

// First violation found, with a pointer to the offending node,
// e.g. blocks[0].slots.main[2] (spec 03-pages).
export interface TreeValidationError {
  pointer: string;
  message: string;
}

const ajv = new Ajv2020({ strict: false, allErrors: false });

// Reserved pseudo-block ERC marking where a page's own content renders
// inside a MASTER template (spec 14). It is never a row in `blocks`; the
// validator and the composition function special-case it.
export const DROP_ZONE_BLOCK = '__page_content__';

interface StructuralNode {
  node: PageTreeNode;
  pointer: string;
}

// Narrow an unknown value to PageTree, returning a pointer error instead of
// throwing. The tree arrives as raw JSON from the API body.
export function parsePageTree(
  value: unknown,
): { tree: PageTree; error: null } | { tree: null; error: TreeValidationError } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { tree: null, error: { pointer: '', message: 'tree must be an object' } };
  }
  const root = value as Record<string, unknown>;
  const keys = Object.keys(root);
  if (keys.some((k) => k !== 'blocks')) {
    return { tree: null, error: { pointer: '', message: 'tree must only contain "blocks"' } };
  }
  if (!Array.isArray(root.blocks)) {
    return { tree: null, error: { pointer: 'blocks', message: 'blocks must be an array' } };
  }
  const structural = checkNodeList(root.blocks, 'blocks');
  if (structural) {
    return { tree: null, error: structural };
  }
  return { tree: value as PageTree, error: null };
}

function checkNodeList(list: unknown[], pointerBase: string): TreeValidationError | null {
  for (let i = 0; i < list.length; i += 1) {
    const pointer = `${pointerBase}[${i}]`;
    const node = list[i];
    if (typeof node !== 'object' || node === null || Array.isArray(node)) {
      return { pointer, message: 'node must be an object' };
    }
    const record = node as Record<string, unknown>;
    const unknownKey = Object.keys(record).find(
      (k) => k !== 'block' && k !== 'props' && k !== 'slots',
    );
    if (unknownKey) {
      return { pointer, message: `unknown node key "${unknownKey}"` };
    }
    if (typeof record.block !== 'string' || record.block.length === 0) {
      return { pointer, message: 'node.block must be a non-empty block ERC string' };
    }
    if (
      record.props !== undefined &&
      (typeof record.props !== 'object' || record.props === null || Array.isArray(record.props))
    ) {
      return { pointer, message: 'node.props must be an object' };
    }
    if (record.slots !== undefined) {
      if (
        typeof record.slots !== 'object' ||
        record.slots === null ||
        Array.isArray(record.slots)
      ) {
        return { pointer, message: 'node.slots must be an object of slot name to node array' };
      }
      for (const [slotName, children] of Object.entries(record.slots)) {
        if (!Array.isArray(children)) {
          return {
            pointer: `${pointer}.slots.${slotName}`,
            message: 'slot value must be an array',
          };
        }
        const childError = checkNodeList(children, `${pointer}.slots.${slotName}`);
        if (childError) {
          return childError;
        }
      }
    }
  }
  return null;
}

// Every block ERC referenced anywhere in the tree, for a single batched
// database lookup by the caller. The drop zone is not a real block and
// never needs a lookup, so it is excluded here.
export function collectBlockRefs(tree: PageTree): string[] {
  const refs = new Set<string>();
  const visit = (nodes: PageTreeNode[]): void => {
    for (const node of nodes) {
      if (node.block !== DROP_ZONE_BLOCK) {
        refs.add(node.block);
      }
      for (const children of Object.values(node.slots ?? {})) {
        visit(children);
      }
    }
  };
  visit(tree.blocks);
  return [...refs];
}

// Number of drop-zone nodes anywhere in the tree (root or nested in a
// slot), for the MASTER-exactly-one check (spec 14). Pure structural count,
// independent of block definitions.
export function countDropZoneNodes(tree: PageTree): number {
  let count = 0;
  const visit = (nodes: PageTreeNode[]): void => {
    for (const node of nodes) {
      if (node.block === DROP_ZONE_BLOCK) {
        count += 1;
      }
      for (const children of Object.values(node.slots ?? {})) {
        visit(children);
      }
    }
  };
  visit(tree.blocks);
  return count;
}

// Validates a structurally sound tree against the tenant's block
// definitions. Returns the first violation or null. `allowDropZone` is only
// set by the page-templates module for a MASTER template's tree; pages and
// STANDARD templates leave it unset, so a drop-zone node falls through to
// the unknown-block branch below (the drop zone is reserved, not a row in
// `blocks`).
export function validatePageTree(
  tree: PageTree,
  blocksByErc: ReadonlyMap<string, BlockDefinition>,
  options: { requirePublished?: boolean; allowDropZone?: boolean } = {},
): TreeValidationError | null {
  const validators = new Map<string, ValidateFunction>();
  const stack: StructuralNode[] = tree.blocks
    .map((node, i) => ({ node, pointer: `blocks[${i}]` }))
    .reverse();

  while (stack.length > 0) {
    // Non-null: length was just checked.
    const { node, pointer } = stack.pop() as StructuralNode;

    if (node.block === DROP_ZONE_BLOCK && options.allowDropZone) {
      if (node.props !== undefined && Object.keys(node.props).length > 0) {
        return { pointer, message: 'the page-content drop zone accepts no props' };
      }
      if (node.slots !== undefined && Object.keys(node.slots).length > 0) {
        return { pointer, message: 'the page-content drop zone accepts no slots' };
      }
      continue;
    }

    const definition = blocksByErc.get(node.block);
    if (!definition) {
      return { pointer, message: `unknown block "${node.block}"` };
    }
    if (options.requirePublished && definition.status !== 'PUBLISHED') {
      return {
        pointer,
        message: `block "${node.block}" is ${definition.status}, only PUBLISHED blocks can be referenced by a published page`,
      };
    }

    let validate = validators.get(node.block);
    if (!validate) {
      try {
        // Ajv registers $id-bearing schemas process-wide; clear before each
        // compile so a repeated $id across requests cannot collide (same
        // guard as block-validation.ts).
        ajv.removeSchema();
        validate = ajv.compile(definition.propsSchema);
      } catch {
        // Stored propsSchema should always compile (blocks validates it on
        // write); a failure here means corrupt data, still a 400 for this tree.
        return { pointer, message: `block "${node.block}" has an uncompilable propsSchema` };
      }
      validators.set(node.block, validate);
    }
    if (!validate(node.props ?? {})) {
      const first = validate.errors?.[0];
      const where = first?.instancePath ? ` at props${first.instancePath}` : '';
      return {
        pointer,
        message: `props do not match block "${node.block}" schema${where}: ${first?.message ?? 'invalid'}`,
      };
    }

    const declared = new Set(definition.slots.map((s) => s.name));
    for (const [slotName, children] of Object.entries(node.slots ?? {})) {
      if (!declared.has(slotName)) {
        return {
          pointer,
          message: `slot "${slotName}" is not declared by block "${node.block}"`,
        };
      }
      for (let i = children.length - 1; i >= 0; i -= 1) {
        // Non-null: i is within bounds.
        const child = children[i] as PageTreeNode;
        stack.push({ node: child, pointer: `${pointer}.slots.${slotName}[${i}]` });
      }
    }
  }
  return null;
}
