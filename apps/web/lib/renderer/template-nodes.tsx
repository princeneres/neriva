import { createElement, type ReactNode } from 'react';
import { parseAttrs, styleStringToObject, type TemplateNode } from './template';

// Attributes React spells differently. Everything else (data-*, aria-*, id,
// href, src, alt, role, title...) already matches, so it passes straight
// through: React accepts unknown lowercase attributes on host elements.
const PROP_NAME_MAP: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  maxlength: 'maxLength',
  tabindex: 'tabIndex',
  readonly: 'readOnly',
  autocomplete: 'autoComplete',
  srcset: 'srcSet',
  usemap: 'useMap',
};

// Attributes with no value in the markup are booleans in React.
const BOOLEAN_ATTRS = new Set(['checked', 'disabled', 'readonly', 'required', 'selected']);

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

export function attrsToProps(attrsText: string): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(parseAttrs(attrsText))) {
    if (name === 'style') {
      props.style = styleStringToObject(value);
      continue;
    }
    if (BOOLEAN_ATTRS.has(name) && value === '') {
      props[PROP_NAME_MAP[name] ?? name] = true;
      continue;
    }
    props[PROP_NAME_MAP[name] ?? name] = value;
  }
  return props;
}

// display: contents keeps this wrapper out of the layout, so the markup
// behaves as a direct child of its parent element.
function defaultHtmlRun(html: string, key: number): ReactNode {
  return (
    <div key={key} style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

// Renders a template tree. Elements that wrap a slot become real React
// elements, so the slot children sit inside them; runs of markup with no slot
// inside stay raw html, which is safe because the tree builder only leaves
// balanced runs behind.
//
// renderHtmlRun lets the studio canvas swap in its contentEditable wrapper for
// those raw runs while sharing this traversal, so the canvas and the published
// page cannot drift apart on nesting.
export function renderTemplateNodes(
  nodes: TemplateNode[],
  slots: Record<string, ReactNode>,
  renderHtmlRun: (html: string, key: number) => ReactNode = defaultHtmlRun,
): ReactNode {
  return nodes.map((node, index) => {
    if (node.kind === 'html') {
      return renderHtmlRun(node.html, index);
    }
    const props = { ...attrsToProps(node.attrs), key: index };
    if (node.kind === 'slot') {
      return createElement(node.tag, props, slots[node.name] ?? null);
    }
    if (VOID_TAGS.has(node.tag)) {
      return createElement(node.tag, props);
    }
    return createElement(node.tag, props, renderTemplateNodes(node.children, slots, renderHtmlRun));
  });
}
