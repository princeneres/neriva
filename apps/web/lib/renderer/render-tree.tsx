import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { rendererFor } from './registry';
import { renderTemplate, resolveStyles, type NavPage } from './template';
import { renderTemplateNodes } from './template-nodes';

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
// (from the delivery API or the admin blocks list). sitePages feeds
// data-nv-nav (header/footer navigation); omit it to keep templates'
// authored placeholder links, e.g. in a bare block preview.
export function RenderTree({
  tree,
  blockInfo = {},
  sitePages,
  siteSlug,
  siteBasePath,
}: {
  tree: RenderTreeInput;
  blockInfo?: Record<string, BlockInfo>;
  sitePages?: NavPage[];
  // Which site's published content the data-driven blocks should read; omit it
  // in a bare block preview, where those blocks explain themselves instead.
  siteSlug?: string;
  siteBasePath?: string;
}) {
  // Tree-level dedupe: one <style> per distinct templated block ERC.
  const emittedCss = new Set<string>();
  return (
    <>
      {renderNodes(tree.blocks, blockInfo, 'root', emittedCss, sitePages, siteSlug, siteBasePath)}
    </>
  );
}

function renderNodes(
  nodes: RenderNode[],
  blockInfo: Record<string, BlockInfo>,
  keyBase: string,
  emittedCss: Set<string>,
  sitePages: NavPage[] | undefined,
  siteSlug: string | undefined,
  siteBasePath: string | undefined,
): ReactNode {
  return nodes.map((node, index) => {
    const key = `${keyBase}-${index}-${node.block}`;
    const info = blockInfo[node.block];
    const slots: Record<string, ReactNode> = {};
    for (const [slotName, children] of Object.entries(node.slots ?? {})) {
      slots[slotName] = renderNodes(
        children,
        blockInfo,
        `${key}-${slotName}`,
        emittedCss,
        sitePages,
        siteSlug,
        siteBasePath,
      );
    }
    // Heading is a native semantic renderer. It used to be seeded as a
    // template with a hard-coded h2, which made the level control visual-only
    // and could leave a published page without its intended h1.
    const content =
      info?.html && node.block !== 'nv-heading'
        ? renderTemplateBlock(node, info.html, info, slots, emittedCss, sitePages, siteBasePath)
        : renderRegistryBlock(node, info, slots, siteSlug);
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
  siteSlug: string | undefined,
): ReactNode {
  const Renderer = rendererFor(node.block);
  return (
    <Renderer
      props={node.props ?? {}}
      slots={slots}
      blockName={info?.name ?? node.block}
      siteSlug={siteSlug}
    />
  );
}

function renderTemplateBlock(
  node: RenderNode,
  html: string,
  info: BlockInfo,
  slots: Record<string, ReactNode>,
  emittedCss: Set<string>,
  sitePages: NavPage[] | undefined,
  siteBasePath: string | undefined,
): ReactNode {
  const declaredSlots = info.slots?.map((slot) => (typeof slot === 'string' ? slot : slot.name));
  const { nodes, css } = renderTemplate({
    html,
    css: info.css,
    erc: node.block,
    props: node.props ?? {},
    slots: declaredSlots,
    sitePages,
    siteBasePath,
  });
  let style: ReactNode = null;
  if (css !== '' && !emittedCss.has(node.block)) {
    emittedCss.add(node.block);
    // scopeCss escapes "</" so the css cannot close the style element.
    style = <style dangerouslySetInnerHTML={{ __html: css }} />;
  }
  const first = nodes[0];
  if (nodes.length === 1 && first !== undefined && first.kind === 'html') {
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
      <div data-nv-b={node.block}>{renderTemplateNodes(nodes, slots)}</div>
    </>
  );
}
