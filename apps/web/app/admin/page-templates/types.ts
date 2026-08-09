// Page templates and master pages (spec 14). The contracts package does not
// generate these DTOs yet (the API module lands from a parallel agent
// against the same spec), so the entity shape is declared locally here,
// matching spec 14 section 1/2 exactly. Swap for `components['schemas']`
// once @neriva/contracts regenerates.

import type { Block } from '../pages/types';
import type { PageTree } from '../pages/tree-utils';

export type PageTemplateKind = 'MASTER' | 'STANDARD';

export interface PageTemplate {
  id: string;
  externalReferenceCode: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  name: string;
  kind: PageTemplateKind;
  // null = available to every site; set = offered only for that site.
  siteId: string | null;
  tree: PageTree;
}

export interface PageTemplatePayload {
  name: string;
  tree: PageTree;
}

// The reserved pseudo-block ERC marking where a page's own content renders
// inside a master (spec 14 section 1). Not a row in `blocks`.
export const DROP_ZONE_ERC = '__page_content__';

export function defaultTreeFor(kind: PageTemplateKind): PageTree {
  return kind === 'MASTER' ? { blocks: [{ block: DROP_ZONE_ERC }] } : { blocks: [] };
}

// Recursive block count for the gallery card summary; counts every node,
// including the drop zone (it is a node in the tree like any other).
export function countBlocks(tree: PageTree): number {
  function countAll(nodes: PageTree['blocks']): number {
    let total = 0;
    for (const node of nodes) {
      total += 1;
      for (const children of Object.values(node.slots ?? {})) {
        total += countAll(children);
      }
    }
    return total;
  }
  return countAll(tree.blocks);
}

// A synthetic palette/picker entry for the drop zone. It is not a real block
// from the API: it renders a fixed placeholder card in the canvas (its
// `html` template) and inserts through the exact same editor-state helpers
// as any other block, since it is just a node with no props or slots.
export function pageContentPaletteBlock(): Block {
  return {
    id: DROP_ZONE_ERC,
    externalReferenceCode: DROP_ZONE_ERC,
    tenantId: '',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    createdBy: null,
    status: 'PUBLISHED',
    name: 'Page content',
    category: 'layout',
    description: 'Marks where each page fills in its own content inside this master.',
    propsSchema: { type: 'object', properties: {} },
    slots: [],
    html: `<div style="border:2px dashed #b7c0cc;border-radius:10px;padding:2.75rem 1.25rem;text-align:center;background:#f4f6f8;color:#4c5561;font-weight:600;font-size:0.95rem;">
  Page content renders here
  <div style="font-weight:400;font-size:0.8rem;color:#828e9b;margin-top:6px;">Every page using this master fills this spot with its own blocks.</div>
</div>`,
    css: null,
  };
}
