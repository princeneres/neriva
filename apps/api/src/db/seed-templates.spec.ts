import { describe, expect, it } from 'vitest';
import { validateBlockCss, validateBlockTemplate } from '../modules/blocks/template-validation';
import { DEMO_BLOCKS } from './demo-seed.service';
import { NATIVE_BLOCKS, NATIVE_BLOCK_ERCS } from './native-blocks-seed.service';

// Seeds insert rows directly (no service round-trip), so this proves every
// shipped template would also pass the write-time validation of POST /blocks.
// Blocks the renderer draws from its own registry carry no template at all
// (spec 12): there is nothing to validate, but a block that does declare one
// must still pass, so the two cases are asserted apart instead of skipped.
const REGISTRY_RENDERED_ERCS = ['nv-post-list', 'nv-todo-list'] as const;

describe('seeded block templates', () => {
  it('covers every native ERC', () => {
    expect(NATIVE_BLOCKS.map((b) => b.erc)).toEqual([...NATIVE_BLOCK_ERCS]);
  });

  it.each(REGISTRY_RENDERED_ERCS.map((erc) => [erc] as const))(
    'native block %s is registry rendered, so it declares no template',
    (erc) => {
      const block = NATIVE_BLOCKS.find((candidate) => candidate.erc === erc);
      if (!block) {
        throw new Error(`${erc} is missing from the native blocks catalog`);
      }
      expect(block.html).toBeNull();
      expect(block.css).toBeNull();
    },
  );

  it.each(
    NATIVE_BLOCKS.filter(
      (b) => !REGISTRY_RENDERED_ERCS.includes(b.erc as (typeof REGISTRY_RENDERED_ERCS)[number]),
    ).map((b) => [b.erc, b] as const),
  )('native block %s has a valid template', (_erc, block) => {
    if (block.html === null || block.css === null) {
      throw new Error(`${block.erc} has a template but left html or css null`);
    }
    expect(validateBlockTemplate(block.html, block.slots, block.propsSchema)).toBeNull();
    expect(validateBlockCss(block.css)).toBeNull();
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

  it.each(DEMO_BLOCKS.map((b) => [b.erc, b] as const))(
    'demo block %s has a valid template',
    (_erc, block) => {
      expect(validateBlockTemplate(block.html, block.slots, block.propsSchema)).toBeNull();
      expect(validateBlockCss(block.css)).toBeNull();
    },
  );
});
