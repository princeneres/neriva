import { describe, expect, it } from 'vitest';
import {
  validateBlockCss,
  validateBlockJavaScript,
  validateBlockTemplate,
} from '../modules/blocks/template-validation';
import { DEMO_BLOCKS } from './demo-seed.service';
import { NATIVE_BLOCKS, NATIVE_BLOCK_ERCS } from './native-blocks-seed.service';

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
