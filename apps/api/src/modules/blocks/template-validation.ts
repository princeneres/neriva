import type { BlockSlot } from '../../db/schema';

// Write-time validation of block templates (spec 12, ADR-003). Templates are
// data, never executed on the server: this module only enforces the v1
// syntax constraints and the sanitization rules, both returning the
// human-readable reason for the 400 response, or null when valid.

// Binding attributes: they render a prop value and make the element
// inline-editable on the studio canvas. data-nv-alt is the companion of
// data-nv-image; data-nv-embed and data-nv-html are engine hooks (video
// embeds, raw html) validated with the same rules.
const BINDING_ATTRIBUTES = new Set([
  'data-nv-text',
  'data-nv-rich',
  'data-nv-image',
  'data-nv-link',
  'data-nv-alt',
  'data-nv-embed',
  'data-nv-html',
]);

const SLOT_ATTRIBUTE = 'data-nv-slot';

// Reserved engine hook, not a prop binding: the renderer supplies the site's
// published pages at render time, so its value is the fixed marker "pages"
// rather than a propsSchema key (spec 12 section 1, header/footer nav
// amendment; rendering itself is spec 12 section 5).
const NAV_ATTRIBUTE = 'data-nv-nav';
const NAV_ATTRIBUTE_VALUE = 'pages';

// HTML void elements never have children, so they are always leaves.
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

// Tags plus quoted attribute values; text between tags never matches.
const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^"'>])*)(\/?)>/g;
const ATTR_RE = /([^\s"'=/>]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]*))?/g;

interface Attribute {
  name: string;
  value: string | null;
}

interface TagToken {
  kind: 'open' | 'close' | 'self';
  name: string;
  attributes: Attribute[];
  // Offsets of the tag in the template, for inner-content extraction.
  start: number;
  end: number;
}

function parseAttributes(raw: string): Attribute[] {
  const attributes: Attribute[] = [];
  for (const match of raw.matchAll(ATTR_RE)) {
    // Non-null: group 1 always captures at least one character.
    const name = (match[1] as string).toLowerCase();
    const quoted = match[2];
    const value =
      quoted === undefined
        ? null
        : quoted.startsWith('"') || quoted.startsWith("'")
          ? quoted.slice(1, -1)
          : quoted;
    attributes.push({ name, value });
  }
  return attributes;
}

function tokenize(html: string): TagToken[] {
  const tokens: TagToken[] = [];
  for (const match of html.matchAll(TAG_RE)) {
    // Non-null: every group of TAG_RE participates in each match (groups 1,
    // 3 and 4 may capture the empty string, never undefined).
    const closeSlash = match[1] as string;
    const rawAttributes = match[3] as string;
    const selfSlash = match[4] as string;
    const name = (match[2] as string).toLowerCase();
    const kind: TagToken['kind'] =
      closeSlash === '/' ? 'close' : selfSlash === '/' || VOID_ELEMENTS.has(name) ? 'self' : 'open';
    tokens.push({
      kind,
      name,
      attributes: kind === 'close' ? [] : parseAttributes(rawAttributes),
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return tokens;
}

// Index of the close tag matching tokens[openIndex], or -1 when unclosed.
function findMatchingClose(tokens: TagToken[], openIndex: number): number {
  // Non-null: callers pass a valid index.
  const open = tokens[openIndex] as TagToken;
  let depth = 1;
  for (let i = openIndex + 1; i < tokens.length; i += 1) {
    const token = tokens[i] as TagToken;
    if (token.name !== open.name) {
      continue;
    }
    if (token.kind === 'open') {
      depth += 1;
    } else if (token.kind === 'close') {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

// The keys editors can bind: propsSchema.properties, when present.
function schemaPropertyKeys(propsSchema: Record<string, unknown>): Set<string> {
  const properties = propsSchema.properties;
  if (typeof properties !== 'object' || properties === null || Array.isArray(properties)) {
    return new Set();
  }
  return new Set(Object.keys(properties));
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  colon: ':',
  semi: ';',
  sol: '/',
};

// Browsers decode character references before interpreting URL attributes.
// Decode the common named and numeric forms before checking protocols, or an
// attacker can hide `javascript:` behind `j&#x61;vascript:`.
function decodeHtmlEntities(value: string): string {
  return value.replace(/&(?:#x([0-9a-fA-F]+)|#(\d+)|([a-zA-Z]+));?/g, (whole, hex, dec, named) => {
    if (hex || dec) {
      const code = hex ? parseInt(hex as string, 16) : parseInt(dec as string, 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[(named as string).toLowerCase()] ?? whole;
  });
}

// Sanitization (spec 12): templates are authored by permissioned users but
// still must not carry executable content into every visitor's page.
function findSanitizationViolation(html: string, tokens: TagToken[]): string | null {
  if (/<script/i.test(html)) {
    return 'Template html may not contain <script>';
  }
  if (/<iframe/i.test(html)) {
    return 'Template html may not contain <iframe>; use the data-nv-embed engine hook for embeds';
  }
  for (const token of tokens) {
    for (const attribute of token.attributes) {
      if (/^on/i.test(attribute.name)) {
        return `Template html may not contain event handler attributes ("${attribute.name}")`;
      }
      const value = decodeHtmlEntities(attribute.value ?? '')
        .replace(/\s+/g, '')
        .toLowerCase();
      if (/^(?:javascript|vbscript):/.test(value) || value.includes('javascript:')) {
        return `Template html may not contain javascript: URLs ("${attribute.name}")`;
      }
      if (/^data:(?:text|image\/svg\+xml)/.test(value)) {
        return `Template html may not contain data:text URLs ("${attribute.name}")`;
      }
    }
  }
  return null;
}

// Returns null when the template html satisfies the v1 constraints
// (spec 12 section 1), otherwise the reason for the 400 response.
export function validateBlockTemplate(
  html: string,
  slots: BlockSlot[],
  propsSchema: Record<string, unknown>,
): string | null {
  const tokens = tokenize(html);

  const sanitization = findSanitizationViolation(html, tokens);
  if (sanitization) {
    return sanitization;
  }

  const declaredSlots = new Set(slots.map((slot) => slot.name));
  const propertyKeys = schemaPropertyKeys(propsSchema);

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i] as TagToken;
    if (token.kind === 'close') {
      continue;
    }

    const bindings = token.attributes.filter((a) => BINDING_ATTRIBUTES.has(a.name));
    const slotAttribute = token.attributes.find((a) => a.name === SLOT_ATTRIBUTE);
    const navAttribute = token.attributes.find((a) => a.name === NAV_ATTRIBUTE);

    for (const binding of bindings) {
      if (!binding.value) {
        return `${binding.name} on <${token.name}> must name a prop`;
      }
      if (!propertyKeys.has(binding.value)) {
        return `${binding.name}="${binding.value}" binds a prop that does not exist in propsSchema.properties`;
      }
    }
    if (slotAttribute !== undefined) {
      if (!slotAttribute.value) {
        return `data-nv-slot on <${token.name}> must name a slot`;
      }
      if (!declaredSlots.has(slotAttribute.value)) {
        return `data-nv-slot="${slotAttribute.value}" references a slot that is not declared in slots`;
      }
    }
    if (navAttribute !== undefined && navAttribute.value !== NAV_ATTRIBUTE_VALUE) {
      return `data-nv-nav must be "${NAV_ATTRIBUTE_VALUE}"`;
    }

    const markers = bindings.length + (navAttribute !== undefined ? 1 : 0);
    if ((markers === 0 && slotAttribute === undefined) || token.kind === 'self') {
      // Self-closing and void elements are leaves and empty by construction.
      continue;
    }

    const closeIndex = findMatchingClose(tokens, i);
    if (closeIndex === -1) {
      const marker = bindings[0]?.name ?? navAttribute?.name ?? SLOT_ATTRIBUTE;
      return `<${token.name}> carrying ${marker} is never closed`;
    }
    const hasChildTags = closeIndex > i + 1;
    // data-nv-nav is exempt from the leaf constraint: unlike text/rich, its
    // entire inner content is discarded and replaced by the renderer, so an
    // authored placeholder link is a harmless preview default, not a risk.
    if (bindings.length > 0 && hasChildTags) {
      const marker = bindings[0] as Attribute;
      return `${marker.name}="${marker.value ?? ''}" must be on a leaf element, but <${token.name}> contains nested tags`;
    }
    if (slotAttribute !== undefined) {
      const inner = html.slice(token.end, (tokens[closeIndex] as TagToken).start);
      if (hasChildTags || inner.trim().length > 0) {
        return `data-nv-slot="${slotAttribute.value ?? ''}" must be on an empty element, but <${token.name}> has content`;
      }
    }
  }
  return null;
}

// Returns null when the template css passes the write-time sanitization
// (spec 12 section 1), otherwise the reason for the 400 response.
export function validateBlockCss(css: string): string | null {
  if (/@import/i.test(css)) {
    return 'Template css may not use @import';
  }
  if (/expression\s*\(/i.test(css)) {
    return 'Template css may not use expression()';
  }
  if (/url\(\s*["']?\s*javascript/i.test(css)) {
    return 'Template css may not use url(javascript:)';
  }
  return null;
}
