import { describe, expect, it } from 'vitest';
import { DEFAULT_STYLE_BOOK_TOKENS } from '../common/style-tokens';
import {
  validateBlockCss,
  validateBlockJavaScript,
  validateBlockTemplate,
} from '../modules/blocks/template-validation';
import { DEMO_BLOCKS } from './demo-seed.service';
import { NATIVE_BLOCKS, NATIVE_BLOCK_ERCS } from './native-blocks-seed.service';

// Index of the character just past the "(...)" group that starts at `open`.
function endOfGroup(css: string, open: number): number {
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '(') {
      depth += 1;
    } else if (css[i] === ')') {
      depth -= 1;
      if (depth === 0) {
        return i + 1;
      }
    }
  }
  return css.length;
}

// Strips every "var(--nv-name, fallback)" reference, nesting included, so what
// is left is the css that does not go through the Style Book.
function withoutTokenReferences(css: string): string {
  let out = '';
  let i = 0;
  while (i < css.length) {
    if (css.startsWith('var(--nv-', i)) {
      i = endOfGroup(css, i + 'var'.length);
      continue;
    }
    out += css[i];
    i += 1;
  }
  return out;
}

// Every token reference in a stylesheet, outer and nested alike, as the token
// name and the raw fallback written for it.
function tokenReferences(css: string): { name: string; fallback: string }[] {
  const references: { name: string; fallback: string }[] = [];
  const opening = /var\(--nv-([a-z0-9-]+),\s*/g;
  let match = opening.exec(css);
  while (match !== null) {
    const end = endOfGroup(css, match.index + 'var'.length);
    references.push({
      name: match[1] as string,
      fallback: css.slice(opening.lastIndex, end - 1).trim(),
    });
    match = opening.exec(css);
  }
  return references;
}

// Seeds insert rows directly (no service round-trip), so this proves every
// shipped template would also pass the write-time validation of POST /blocks.
describe('seeded block templates', () => {
  it('covers every native ERC', () => {
    expect(NATIVE_BLOCKS.map((b) => b.erc)).toEqual([...NATIVE_BLOCK_ERCS]);
  });

  it.each(NATIVE_BLOCKS.map((b) => [b.erc, b] as const))(
    'native block %s has a valid template',
    (_erc, block) => {
      if (block.html === null || block.css === null) {
        throw new Error(`${block.erc} has a template but left html or css null`);
      }
      expect(validateBlockTemplate(block.html, block.slots, block.propsSchema)).toBeNull();
      expect(validateBlockCss(block.css)).toBeNull();
      if (block.js !== null && block.js !== undefined) {
        expect(validateBlockJavaScript(block.js)).toBeNull();
      }
    },
  );

  // The Style Book only governs what the blocks actually ask it for. A hex,
  // an rgb()/hsl() color, a rem length or a px radius written straight into a
  // block is a decision the client cannot reach from the Style Book screen,
  // which is how the token set ends up decorative. Structural values are the
  // exception and are listed one by one below.
  const STRUCTURAL_LENGTHS = [
    '72rem', // width of the centered content column
    '42rem', // reading measure of a paragraph
    '40rem', // width of the to do list, and the 2-column stacking breakpoint
    '56rem', // 3-column stacking breakpoint
    '17rem', // minimum post card track
    '1.75rem', // header logo box, sized to the brand line
    '2.25rem', // theme toggle hit area
  ];

  it.each(NATIVE_BLOCKS.map((b) => [b.erc, b] as const))(
    'native block %s puts every color, length and radius through a token',
    (_erc, block) => {
      let rest = withoutTokenReferences(block.css ?? '');
      for (const length of STRUCTURAL_LENGTHS) {
        rest = rest.replaceAll(length, '');
      }
      // Optical letter-spacing is a correction to a specific type size, not a
      // decision a client makes, so it stays with the block.
      rest = rest.replaceAll(/letter-spacing:[^;}]*/g, '');
      expect(rest, 'hardcoded color').not.toMatch(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i);
      expect(rest, 'hardcoded length').not.toMatch(/\b\d*\.?\d+(?:rem|em)\b/);
      expect(rest, 'hardcoded radius').not.toMatch(/border-radius:\s*[^;]*\d/);
    },
  );

  it('writes every token fallback from the default token set, so the two cannot drift', () => {
    for (const block of NATIVE_BLOCKS) {
      for (const { name, fallback } of tokenReferences(block.css ?? '')) {
        expect(
          DEFAULT_STYLE_BOOK_TOKENS,
          `${block.erc} uses an unknown token ${name}`,
        ).toHaveProperty(name);
        if (fallback.startsWith('var(--nv-')) {
          // A role that refines an older one falls back to it; the nested
          // reference is checked on its own turn through this loop.
          continue;
        }
        expect(fallback, `${block.erc} drifted from the default of --nv-${name}`).toBe(
          DEFAULT_STYLE_BOOK_TOKENS[name as keyof typeof DEFAULT_STYLE_BOOK_TOKENS],
        );
      }
    }
  });

  it('leaves no token of the default set without a consumer in the native library', () => {
    const used = new Set<string>([
      // The page ground belongs to the page shell, not to any one block: it is
      // painted on .nv-site-root in apps/web/app/s/published-page.tsx.
      'color-background',
    ]);
    for (const block of NATIVE_BLOCKS) {
      for (const { name } of tokenReferences(block.css ?? '')) {
        used.add(name);
      }
    }
    expect([...Object.keys(DEFAULT_STYLE_BOOK_TOKENS)].filter((name) => !used.has(name))).toEqual(
      [],
    );
  });

  // The public page shell pins a root-level block carrying nv-pin-bottom to
  // the bottom of the page and cancels it on nv-pin-after-content (spec 12,
  // page shell). An unset prop interpolates to the empty string, so the
  // pinned default has to come from the static class, not from the schema
  // default alone.
  it('nv-footer declares the bottom pin, its opt-out and a pinned default', () => {
    const footer = NATIVE_BLOCKS.find((block) => block.erc === 'nv-footer');
    if (!footer) {
      throw new Error('nv-footer is missing from the native blocks catalog');
    }
    expect(footer.html).toContain('class="nv-footer nv-pin-bottom nv-pin-{{pinToBottom}}"');
    const properties = (footer.propsSchema as { properties?: Record<string, unknown> }).properties;
    const pin = properties?.pinToBottom as { enum?: unknown; default?: unknown } | undefined;
    expect(pin?.enum).toEqual(['bottom', 'after-content']);
    expect(pin?.default).toBe('bottom');
  });

  it('nv-todo-list declares its data bindings and visible REST contract in source', () => {
    const todo = NATIVE_BLOCKS.find((block) => block.erc === 'nv-todo-list');
    if (!todo || !todo.html || !todo.js) {
      throw new Error('nv-todo-list is missing authorable source');
    }
    expect(todo.html).toContain('data-nv-runtime-object-definition="objectDefinition"');
    expect(todo.html).toContain('data-nv-runtime-title-field="titleField"');
    expect(todo.js).toContain('GET    /object-definitions/:objectDefinition/records?limit=100');
    expect(todo.js).toContain('POST   /object-definitions/:objectDefinition/records');
    expect(todo.js).toContain('PATCH  /object-records/:id');
    expect(todo.js).toContain('DELETE /object-records/:id');
    expect(todo.js).toContain('Neriva.request');
  });

  it.each(DEMO_BLOCKS.map((b) => [b.erc, b] as const))(
    'demo block %s has a valid template',
    (_erc, block) => {
      expect(validateBlockTemplate(block.html, block.slots, block.propsSchema)).toBeNull();
      expect(validateBlockCss(block.css)).toBeNull();
    },
  );
});
