import type { PageTree, PageTreeNode } from '../../db/schema';
import { DROP_ZONE_BLOCK } from './page-tree.validation';

// Splices a page's own blocks into the drop-zone position of a MASTER
// template's tree, wherever it occurs (root or nested in a slot). Pure
// function shared by delivery and any other server-side render path
// (spec 14). Callers validate the master tree contains exactly one drop
// zone before calling this; a missing drop zone simply leaves the master
// tree unchanged.
export function composeWithMaster(masterTree: PageTree, pageTree: PageTree): PageTree {
  return { blocks: spliceDropZone(masterTree.blocks, pageTree.blocks) };
}

// Resolution-order wrapper: no master resolved means the page's own tree
// renders standalone, unchanged from v1 behavior (spec 14).
export function composePageTree(masterTree: PageTree | null, pageTree: PageTree): PageTree {
  return masterTree ? composeWithMaster(masterTree, pageTree) : pageTree;
}

function spliceDropZone(nodes: PageTreeNode[], replacement: PageTreeNode[]): PageTreeNode[] {
  const result: PageTreeNode[] = [];
  for (const node of nodes) {
    if (node.block === DROP_ZONE_BLOCK) {
      result.push(...replacement);
      continue;
    }
    if (node.slots) {
      const slots: Record<string, PageTreeNode[]> = {};
      for (const [slotName, children] of Object.entries(node.slots)) {
        slots[slotName] = spliceDropZone(children, replacement);
      }
      result.push({ ...node, slots });
    } else {
      result.push(node);
    }
  }
  return result;
}
