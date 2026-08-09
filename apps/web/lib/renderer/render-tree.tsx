import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { rendererFor } from './registry';
import { renderTemplate, resolveStyles } from './template';

export interface RenderNode {
  block: string;
  props?: Record<string, unknown>;
  slots?: Record<string, RenderNode[]>;
  // Per-instance styles (spec 12 section 3), resolved via resolveStyles.
  styles?: Record<string, string>;
}

export interface RenderTreeInput {
  blocks: RenderNode[];
}

// Display metadata plus the optional template (ADR-003). Blocks with html
// render through the template engine; the others keep the registry path.
// slots accepts both { name } objects and plain names (delivery API shape).
export interface BlockInfo {
  name: string;
  html?: string | null;
  css?: string | null;
  slots?: ({ name: string } | string)[];
}

// Renders a page tree. blockInfo maps ERC to display metadata and templates
// (from the delivery API or the admin blocks list).
export function RenderTree({
  tree,
  blockInfo = {},
}: {
  tree: RenderTreeInput;
  blockInfo?: Record<string, BlockInfo>;
}) {
  // Tree-level dedupe: one <style> per distinct templated block ERC.
  const emittedCss = new Set<string>();
  return <>{renderNodes(tree.blocks, blockInfo, 'root', emittedCss)}</>;
}

function renderNodes(
  nodes: RenderNode[],
  blockInfo: Record<string, BlockInfo>,
  keyBase: string,
  emittedCss: Set<string>,
): ReactNode {
  return nodes.map((node, index) => {
    const key = `${keyBase}-${index}-${node.block}`;
    const info = blockInfo[node.block];
    const slots: Record<string, ReactNode> = {};
    for (const [slotName, children] of Object.entries(node.slots ?? {})) {
      slots[slotName] = renderNodes(children, blockInfo, `${key}-${slotName}`, emittedCss);
    }
    const content = info?.html
      ? renderTemplateBlock(node, info.html, info, slots, emittedCss)
      : renderRegistryBlock(node, info, slots);
    const nodeStyles = resolveStyles(node.styles);
    return (
      <Fragment key={key}>
        {Object.keys(nodeStyles).length > 0 ? (
          <div style={nodeStyles as CSSProperties}>{content}</div>
        ) : (
          content
        )}
      </Fragment>
    );
  });
}

function renderRegistryBlock(
  node: RenderNode,
  info: BlockInfo | undefined,
  slots: Record<string, ReactNode>,
): ReactNode {
  const Renderer = rendererFor(node.block);
  return <Renderer props={node.props ?? {}} slots={slots} blockName={info?.name ?? node.block} />;
}

function renderTemplateBlock(
  node: RenderNode,
  html: string,
  info: BlockInfo,
  slots: Record<string, ReactNode>,
  emittedCss: Set<string>,
): ReactNode {
  const declaredSlots = info.slots?.map((slot) => (typeof slot === 'string' ? slot : slot.name));
  const { segments, css } = renderTemplate({
    html,
    css: info.css,
    erc: node.block,
    props: node.props ?? {},
    slots: declaredSlots,
  });
  let style: ReactNode = null;
  if (css !== '' && !emittedCss.has(node.block)) {
    emittedCss.add(node.block);
    // scopeCss escapes "</" so the css cannot close the style element.
    style = <style dangerouslySetInnerHTML={{ __html: css }} />;
  }
  const first = segments[0];
  if (segments.length === 1 && first !== undefined && 'html' in first) {
    return (
      <>
        {style}
        <div data-nv-b={node.block} dangerouslySetInnerHTML={{ __html: first.html }} />
      </>
    );
  }
  return (
    <>
      {style}
      <div data-nv-b={node.block}>
        {segments.map((segment, index) =>
          'html' in segment ? (
            // display: contents keeps the segment wrapper out of the layout;
            // template markup behaves as a direct child of the block wrapper.
            <div
              key={index}
              style={{ display: 'contents' }}
              dangerouslySetInnerHTML={{ __html: segment.html }}
            />
          ) : (
            <div key={index} data-nv-slot={segment.slot}>
              {slots[segment.slot] ?? null}
            </div>
          ),
        )}
      </div>
    </>
  );
}
