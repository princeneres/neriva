import type { ReactNode } from 'react';
import { rendererFor } from './registry';

export interface RenderNode {
  block: string;
  props?: Record<string, unknown>;
  slots?: Record<string, RenderNode[]>;
}

export interface RenderTreeInput {
  blocks: RenderNode[];
}

export interface BlockInfo {
  name: string;
}

// Renders a page tree through the block renderer registry. blockInfo maps
// ERC to display metadata (from the delivery API or the admin blocks list).
export function RenderTree({
  tree,
  blockInfo = {},
}: {
  tree: RenderTreeInput;
  blockInfo?: Record<string, BlockInfo>;
}) {
  return <>{renderNodes(tree.blocks, blockInfo, 'root')}</>;
}

function renderNodes(
  nodes: RenderNode[],
  blockInfo: Record<string, BlockInfo>,
  keyBase: string,
): ReactNode {
  return nodes.map((node, index) => {
    const key = `${keyBase}-${index}-${node.block}`;
    const Renderer = rendererFor(node.block);
    const slots: Record<string, ReactNode> = {};
    for (const [slotName, children] of Object.entries(node.slots ?? {})) {
      slots[slotName] = renderNodes(children, blockInfo, `${key}-${slotName}`);
    }
    return (
      <Renderer
        key={key}
        props={node.props ?? {}}
        slots={slots}
        blockName={blockInfo[node.block]?.name ?? node.block}
      />
    );
  });
}
