// Template engine for template blocks (ADR-003, spec 12 section 5).
// Pure string processing, server-safe (no DOM APIs): the same code runs on
// the server (public route) and on the client (studio canvas, block preview).
//
// Trust model: templates are authored by permissioned block authors and
// sanitized at write time (API side). Prop values come from content editors
// and are NEVER trusted: they are escaped ({{prop}}, data-nv-text, attribute
// bindings) or sanitized against a strict allowlist (data-nv-rich).

export type TemplateSegment = { html: string } | { slot: string };

export interface SplitSlotsResult {
  segments: TemplateSegment[];
  slots: string[];
}

export interface RenderTemplateInput {
  html: string;
  css?: string | null;
  erc: string;
  props?: Record<string, unknown>;
  // Declared slot names. When provided, slot markers for undeclared names are
  // dropped from the output instead of producing a slot segment.
  slots?: string[];
}

export interface RenderTemplateResult {
  segments: TemplateSegment[];
  css: string;
}

function toText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

export function escapeHtml(value: unknown): string {
  return toText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// {{propKey}} interpolation, always escaped. Single pass: values containing
// {{...}} are inserted literally and never re-interpolated.
export function interpolate(html: string, props: Record<string, unknown>): string {
  return html.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (_match, key: string) =>
    escapeHtml(props[key]),
  );
}

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

// Returns the URL when it uses a safe protocol or is relative, '' otherwise.
// Control characters and spaces are stripped before the scheme check because
// browsers ignore them when parsing ("java\nscript:" is still javascript:).
export function safeUrl(value: unknown): string {
  const raw = toText(value).trim();
  if (raw === '') {
    return '';
  }
  // eslint-disable-next-line no-control-regex
  const compact = raw.replace(/[\u0000-\u0020]/g, '');
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(compact);
  if (!scheme) {
    return raw;
  }
  return SAFE_PROTOCOLS.has(`${(scheme[1] ?? '').toLowerCase()}:`) ? raw : '';
}

// --- shared tag scanning helpers -------------------------------------------

// Matches an opening tag. Quoted attribute values may contain ">".
const TAG_PATTERN = /<([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

const VOID_ELEMENTS = new Set([
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

function getAttr(attrsText: string, name: string): string | undefined {
  const pattern = new RegExp(
    `(?:^|[\\s"'])${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
    'i',
  );
  const match = pattern.exec(attrsText);
  if (!match) {
    return undefined;
  }
  return match[1] ?? match[2] ?? match[3] ?? '';
}

// Replaces (or appends) an attribute on an opening tag string. The value must
// already be HTML-escaped by the caller.
function setAttr(tagText: string, name: string, value: string): string {
  const existing = new RegExp(`(\\s${name}\\s*=\\s*)("[^"]*"|'[^']*'|[^\\s>]*)`, 'i');
  if (existing.test(tagText)) {
    return tagText.replace(existing, (_match, prefix: string) => `${prefix}"${value}"`);
  }
  return tagText.replace(/\s*\/?>$/, (end) => ` ${name}="${value}"${end.trimStart()}`);
}

// --- rich text sanitization --------------------------------------------------

const RICH_ALLOWED = new Set(['p', 'br', 'b', 'strong', 'i', 'em', 'a', 'ul', 'ol', 'li']);

// Disallowed elements whose text content must also be dropped.
const RICH_DROP_CONTENT = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'svg',
  'math',
  'title',
  'textarea',
  'noscript',
]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  colon: ':',
  sol: '/',
  semi: ';',
};

// Minimal entity decoding so href validation sees the URL a browser would see
// ("javascript&colon;" must not slip past the scheme check). Entities outside
// this set stay encoded; re-escaping on output keeps them inert either way.
function decodeEntities(text: string): string {
  return text.replace(/&(?:#x([0-9a-fA-F]+)|#(\d+)|([a-zA-Z]+));/g, (whole, hex, dec, named) => {
    if (hex || dec) {
      const code = hex ? parseInt(hex as string, 16) : parseInt(dec as string, 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    const replacement = NAMED_ENTITIES[(named as string).toLowerCase()];
    return replacement ?? whole;
  });
}

// Escapes text-node content. "&" is kept so authored entities survive; a bare
// "&" is already inert as text.
function escapeTextNode(text: string): string {
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Sanitizes editor-provided rich text against the spec 12 allowlist:
// p, br, b, strong, i, em, a[href with safe protocols], ul, ol, li.
// Every attribute except a[href] is stripped. Disallowed tags are removed but
// their text is kept, except for script-like elements whose content is
// dropped wholesale. Open tags are balanced so the output cannot leak
// formatting past the bound element.
export function sanitizeRich(value: unknown): string {
  const input = toText(value).replace(/<!--[\s\S]*?-->/g, '');
  const tagScanner = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let out = '';
  let cursor = 0;
  const stack: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = tagScanner.exec(input))) {
    out += escapeTextNode(input.slice(cursor, match.index));
    cursor = tagScanner.lastIndex;
    const closing = match[1] === '/';
    const name = (match[2] ?? '').toLowerCase();
    const attrsText = match[3] ?? '';
    if (!closing && RICH_DROP_CONTENT.has(name)) {
      const closePattern = new RegExp(`</${name}\\s*>`, 'gi');
      closePattern.lastIndex = cursor;
      const close = closePattern.exec(input);
      cursor = close ? closePattern.lastIndex : input.length;
      tagScanner.lastIndex = cursor;
      continue;
    }
    if (!RICH_ALLOWED.has(name)) {
      continue;
    }
    if (closing) {
      const openedAt = stack.lastIndexOf(name);
      if (openedAt === -1) {
        continue;
      }
      while (stack.length > openedAt) {
        out += `</${stack.pop()}>`;
      }
      continue;
    }
    if (name === 'br') {
      out += '<br>';
      continue;
    }
    if (name === 'a') {
      const href = safeUrl(decodeEntities(getAttr(attrsText, 'href') ?? ''));
      out += href ? `<a href="${escapeHtml(href)}">` : '<a>';
    } else {
      out += `<${name}>`;
    }
    if (/\/\s*$/.test(attrsText)) {
      out += `</${name}>`;
    } else {
      stack.push(name);
    }
  }
  out += escapeTextNode(input.slice(cursor));
  while (stack.length > 0) {
    out += `</${stack.pop()}>`;
  }
  return out;
}

// --- embeds -------------------------------------------------------------------

// Normalizes a watch/embed URL from an allowlisted host to its embed form.
// Returns null for anything else: unparseable, non-http(s), unknown host or an
// unrecognized path shape.
export function normalizeEmbedUrl(value: unknown): string | null {
  const raw = toText(value).trim();
  if (raw === '') {
    return null;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
  const isVideoId = (id: string) => /^[A-Za-z0-9_-]{5,20}$/.test(id);
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') {
      const id = url.searchParams.get('v') ?? '';
      return isVideoId(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    const id = /^\/(?:embed|shorts)\/([A-Za-z0-9_-]+)$/.exec(url.pathname)?.[1];
    return id !== undefined && isVideoId(id)
      ? `https://www.youtube-nocookie.com/embed/${id}`
      : null;
  }
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1);
    return isVideoId(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === 'player.vimeo.com') {
    const id = /^\/video\/(\d+)$/.exec(url.pathname)?.[1];
    return id !== undefined ? `https://player.vimeo.com/video/${id}` : null;
  }
  if (host === 'vimeo.com') {
    const id = /^\/(\d+)$/.exec(url.pathname)?.[1];
    return id !== undefined ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}

// Sandboxed iframe for allowlisted embeds. "allow-scripts" is intentionally
// not combined with "allow-same-origin" so the embedded document stays in an
// opaque origin. Non-allowlisted URLs render a muted placeholder div.
function renderEmbed(value: unknown, className: string | undefined): string {
  const classAttr = className ? ` class="${escapeHtml(className)}"` : '';
  const src = normalizeEmbedUrl(value);
  if (src === null) {
    let host = '';
    try {
      host = new URL(toText(value).trim()).hostname;
    } catch {
      host = '';
    }
    const label = host === '' ? 'Embed unavailable' : `Embed unavailable: ${escapeHtml(host)}`;
    const placeholderStyle =
      'padding:2rem 1rem;text-align:center;background:var(--nv-color-surface, #f4f3f1);' +
      'color:var(--nv-color-text-muted, #8a8782);border-radius:var(--nv-radius-md, 8px);' +
      'font-size:0.875rem';
    return `<div${classAttr} data-nv-embed-blocked="" style="${placeholderStyle}">${label}</div>`;
  }
  return (
    `<iframe${classAttr} src="${escapeHtml(src)}" sandbox="allow-scripts"` +
    ' referrerpolicy="strict-origin-when-cross-origin" loading="lazy" allowfullscreen=""' +
    ' frameborder="0" title="Embedded media"></iframe>'
  );
}

// --- binding application --------------------------------------------------

interface ElementSpan {
  selfClosing: boolean;
  innerStart: number;
  innerEnd: number;
  end: number;
  closeText: string;
}

// Locates the end of the element opened by the tag that TAG_PATTERN matched.
// The v1 leaf constraint (no nested tags inside bound elements) makes "the
// next matching close tag" correct; malformed input degrades to treating the
// element as content-less.
function elementSpan(html: string, name: string, attrsText: string, openEnd: number): ElementSpan {
  if (VOID_ELEMENTS.has(name) || /\/\s*$/.test(attrsText)) {
    return {
      selfClosing: true,
      innerStart: openEnd,
      innerEnd: openEnd,
      end: openEnd,
      closeText: '',
    };
  }
  const closePattern = new RegExp(`</${name}\\s*>`, 'gi');
  closePattern.lastIndex = openEnd;
  const close = closePattern.exec(html);
  if (!close) {
    return {
      selfClosing: true,
      innerStart: openEnd,
      innerEnd: openEnd,
      end: openEnd,
      closeText: '',
    };
  }
  return {
    selfClosing: false,
    innerStart: openEnd,
    innerEnd: close.index,
    end: closePattern.lastIndex,
    closeText: close[0],
  };
}

// Applies data-nv-* bindings. When the bound prop key is absent from props the
// template's authored default is kept (so seeded blocks show their example
// content); a present value always wins, including the empty string.
function applyBindings(html: string, props: Record<string, unknown>): string {
  let out = '';
  let cursor = 0;
  const scanner = new RegExp(TAG_PATTERN.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = scanner.exec(html))) {
    const tagText = match[0];
    const rawName = match[1] ?? '';
    const attrsText = match[2] ?? '';
    if (!/data-nv-(text|rich|image|alt|link|embed)/i.test(attrsText)) {
      continue;
    }
    const name = rawName.toLowerCase();
    const binding = {
      text: getAttr(attrsText, 'data-nv-text'),
      rich: getAttr(attrsText, 'data-nv-rich'),
      image: getAttr(attrsText, 'data-nv-image'),
      alt: getAttr(attrsText, 'data-nv-alt'),
      link: getAttr(attrsText, 'data-nv-link'),
      embed: getAttr(attrsText, 'data-nv-embed'),
    };
    if (Object.values(binding).every((key) => key === undefined)) {
      continue;
    }
    out += html.slice(cursor, match.index);
    const span = elementSpan(html, name, attrsText, scanner.lastIndex);
    if (binding.embed !== undefined) {
      out += renderEmbed(props[binding.embed], getAttr(attrsText, 'class'));
      cursor = span.end;
      scanner.lastIndex = span.end;
      continue;
    }
    let openTag = tagText;
    if (binding.image !== undefined && binding.image in props) {
      openTag = setAttr(openTag, 'src', escapeHtml(safeUrl(props[binding.image])));
    }
    if (binding.alt !== undefined && binding.alt in props) {
      openTag = setAttr(openTag, 'alt', escapeHtml(props[binding.alt]));
    }
    if (binding.link !== undefined && binding.link in props) {
      openTag = setAttr(openTag, 'href', escapeHtml(safeUrl(props[binding.link])));
    }
    out += openTag;
    if (!span.selfClosing) {
      let inner = html.slice(span.innerStart, span.innerEnd);
      if (binding.text !== undefined && binding.text in props) {
        inner = escapeHtml(props[binding.text]);
      } else if (binding.rich !== undefined && binding.rich in props) {
        inner = sanitizeRich(props[binding.rich]);
      }
      out += inner + span.closeText;
    }
    cursor = span.end;
    scanner.lastIndex = span.end;
  }
  out += html.slice(cursor);
  return out;
}

// --- slot splitting ---------------------------------------------------------

// Splits the html at elements bearing data-nv-slot. The slot element itself is
// removed from the html segments (RenderTree recreates the wrapper around the
// slot children), and any children it had are discarded, matching the spec
// wording that slot children are replaced by the slot content. Whitespace-only
// segments are dropped.
export function splitSlots(html: string): SplitSlotsResult {
  const segments: TemplateSegment[] = [];
  const slots: string[] = [];
  let cursor = 0;
  const scanner = new RegExp(TAG_PATTERN.source, 'g');
  let match: RegExpExecArray | null;
  const pushHtml = (segment: string) => {
    if (segment.trim() !== '') {
      segments.push({ html: segment });
    }
  };
  while ((match = scanner.exec(html))) {
    const rawName = match[1] ?? '';
    const attrsText = match[2] ?? '';
    const slotName = getAttr(attrsText, 'data-nv-slot');
    if (slotName === undefined || slotName === '') {
      continue;
    }
    const span = elementSpan(html, rawName.toLowerCase(), attrsText, scanner.lastIndex);
    pushHtml(html.slice(cursor, match.index));
    segments.push({ slot: slotName });
    if (!slots.includes(slotName)) {
      slots.push(slotName);
    }
    cursor = span.end;
    scanner.lastIndex = span.end;
  }
  pushHtml(html.slice(cursor));
  return { segments, slots };
}

// --- css scoping -------------------------------------------------------------

// Conditional group rules whose inner rules must be scoped too.
const SCOPED_AT_RULES = new Set(['media', 'supports', 'container', 'layer', 'scope']);

// Prefixes every top-level selector with [data-nv-b="<erc>"]. A leading :root
// is rewritten to the wrapper itself so token overrides work per block.
// Best-effort tokenizer: strings and parentheses are respected when splitting
// selector lists; declaration bodies are copied verbatim (nested CSS inside a
// style rule is not re-scoped, it is already contained by its parent).
// "</" is escaped in the output so the result is always safe inside <style>.
export function scopeCss(css: string, erc: string): string {
  const prefix = `[data-nv-b="${erc}"]`;
  return scopeBlock(css, prefix).replace(/<\//g, '<\\/');
}

function scopeBlock(css: string, prefix: string): string {
  let out = '';
  let prelude = '';
  let i = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const comment = end === -1 ? css.slice(i) : css.slice(i, end + 2);
      prelude += comment;
      i += comment.length;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const str = readString(css, i);
      prelude += str;
      i += str.length;
      continue;
    }
    if (ch === ';') {
      out += `${prelude};`;
      prelude = '';
      i += 1;
      continue;
    }
    if (ch === '}') {
      // Stray close brace at this level: preserved verbatim.
      out += `${prelude}}`;
      prelude = '';
      i += 1;
      continue;
    }
    if (ch === '{') {
      const block = readBlock(css, i);
      i = block.end;
      const trimmed = prelude.trim();
      if (trimmed.startsWith('@')) {
        const atRule = /^@([a-zA-Z-]+)/.exec(trimmed)?.[1]?.toLowerCase() ?? '';
        out += SCOPED_AT_RULES.has(atRule)
          ? `${prelude}{${scopeBlock(block.inner, prefix)}}`
          : `${prelude}{${block.inner}}`;
      } else if (trimmed === '') {
        out += `${prelude}{${block.inner}}`;
      } else {
        const lead = /^\s*/.exec(prelude)?.[0] ?? '';
        out += `${lead}${prefixSelectors(prelude.slice(lead.length), prefix)} {${block.inner}}`;
      }
      prelude = '';
      continue;
    }
    prelude += ch;
    i += 1;
  }
  return out + prelude;
}

function readString(css: string, start: number): string {
  const quote = css[start];
  let i = start + 1;
  while (i < css.length) {
    if (css[i] === '\\') {
      i += 2;
      continue;
    }
    if (css[i] === quote || css[i] === '\n') {
      i += 1;
      break;
    }
    i += 1;
  }
  return css.slice(start, Math.min(i, css.length));
}

// Reads a { ... } block starting at the opening brace, tracking nested braces,
// strings and comments. Returns the inner text and the index after the close.
function readBlock(css: string, start: number): { inner: string; end: number } {
  let depth = 0;
  let i = start;
  while (i < css.length) {
    const ch = css[i];
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? css.length : end + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      i += readString(css, i).length;
      continue;
    }
    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return { inner: css.slice(start + 1, i), end: i + 1 };
      }
    }
    i += 1;
  }
  // Unterminated block: treat the rest as inner content.
  return { inner: css.slice(start + 1), end: css.length };
}

function prefixSelectors(selectorList: string, prefix: string): string {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let i = 0;
  while (i < selectorList.length) {
    const ch = selectorList[i];
    if (ch === '"' || ch === "'") {
      const str = readString(selectorList, i);
      current += str;
      i += str.length;
      continue;
    }
    if (ch === '/' && selectorList[i + 1] === '*') {
      const end = selectorList.indexOf('*/', i + 2);
      const comment = end === -1 ? selectorList.slice(i) : selectorList.slice(i, end + 2);
      current += comment;
      i += comment.length;
      continue;
    }
    if (ch === '(' || ch === '[') {
      depth += 1;
    } else if (ch === ')' || ch === ']') {
      depth -= 1;
    } else if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }
  parts.push(current);
  return parts
    .map((part) => {
      // Leading comments stay in front of the injected prefix.
      const leading = /^(?:\s|\/\*[\s\S]*?\*\/)*/.exec(part)?.[0] ?? '';
      const selector = part.slice(leading.length).trim();
      if (selector === '') {
        return leading.trim();
      }
      const scoped = selector.startsWith(':root')
        ? `${prefix}${selector.slice(':root'.length)}`
        : `${prefix} ${selector}`;
      return `${leading.trimStart()}${scoped}`;
    })
    .filter((part) => part !== '')
    .join(', ');
}

// --- per-instance node styles (spec 12 section 3) -----------------------------

// Whitelisted node style keys mapped to React style properties. textColor maps
// to color; everything else is the same camelCase CSS property.
const STYLE_PROPERTY_MAP: Record<string, string> = {
  marginTop: 'marginTop',
  marginRight: 'marginRight',
  marginBottom: 'marginBottom',
  marginLeft: 'marginLeft',
  paddingTop: 'paddingTop',
  paddingRight: 'paddingRight',
  paddingBottom: 'paddingBottom',
  paddingLeft: 'paddingLeft',
  background: 'background',
  textColor: 'color',
  fontSize: 'fontSize',
  textAlign: 'textAlign',
  borderRadius: 'borderRadius',
  borderWidth: 'borderWidth',
  borderColor: 'borderColor',
  maxWidth: 'maxWidth',
  minHeight: 'minHeight',
  alignSelf: 'alignSelf',
};

// Resolves a node's styles object to inline style properties. token:<name>
// values become var(--nv-<name>). Unknown keys, non-string values, empty and
// oversized (>100 chars) values are ignored, mirroring the API whitelist.
// borderWidth/borderColor imply borderStyle: solid (the whitelist has no
// borderStyle key, so a border could never appear otherwise).
export function resolveStyles(
  styles: Record<string, unknown> | null | undefined,
): Record<string, string> {
  const resolved: Record<string, string> = {};
  if (!styles) {
    return resolved;
  }
  for (const [key, raw] of Object.entries(styles)) {
    const property = STYLE_PROPERTY_MAP[key];
    if (property === undefined || typeof raw !== 'string') {
      continue;
    }
    const value = raw.trim();
    if (value === '' || value.length > 100) {
      continue;
    }
    const token = /^token:([A-Za-z0-9-]+)$/.exec(value);
    resolved[property] = token ? `var(--nv-${token[1]})` : value;
  }
  if (
    (resolved.borderWidth !== undefined || resolved.borderColor !== undefined) &&
    resolved.borderStyle === undefined
  ) {
    resolved.borderStyle = 'solid';
  }
  return resolved;
}

// --- composition --------------------------------------------------------------

// Full pipeline: interpolate escaped props, apply data-nv-* bindings, split at
// slots and scope the css to the block wrapper.
export function renderTemplate(input: RenderTemplateInput): RenderTemplateResult {
  const props = input.props ?? {};
  const bound = applyBindings(interpolate(input.html, props), props);
  const { segments } = splitSlots(bound);
  const declared = input.slots;
  const filtered = declared
    ? segments.filter((segment) => !('slot' in segment) || declared.includes(segment.slot))
    : segments;
  const css = input.css ? scopeCss(input.css, input.erc) : '';
  return { segments: filtered, css };
}
