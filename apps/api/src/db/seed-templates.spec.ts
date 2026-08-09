import { describe, expect, it } from 'vitest';
import { validateBlockCss, validateBlockTemplate } from '../modules/blocks/template-validation';
import { DEMO_BLOCKS } from './demo-seed.service';
import { NATIVE_BLOCKS, NATIVE_BLOCK_ERCS } from './native-blocks-seed.service';

// Seeds insert rows directly (no service round-trip), so this proves every
// shipped template would also pass the write-time validation of POST /blocks.
describe('seeded block templates', () => {
  it('covers all twelve native ERCs', () => {
    expect(NATIVE_BLOCKS.map((b) => b.erc)).toEqual([...NATIVE_BLOCK_ERCS]);
  });

  it.each(NATIVE_BLOCKS.map((b) => [b.erc, b] as const))(
    'native block %s has a valid template',
    (_erc, block) => {
      expect(validateBlockTemplate(block.html, block.slots, block.propsSchema)).toBeNull();
      expect(validateBlockCss(block.css)).toBeNull();
    },
  );

  it.each(DEMO_BLOCKS.map((b) => [b.erc, b] as const))(
    'demo block %s has a valid template',
    (_erc, block) => {
      expect(validateBlockTemplate(block.html, block.slots, block.propsSchema)).toBeNull();
      expect(validateBlockCss(block.css)).toBeNull();
    },
  );
});
