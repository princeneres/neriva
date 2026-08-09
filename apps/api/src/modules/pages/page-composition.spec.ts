import { describe, expect, it } from 'vitest';
import type { PageTree } from '../../db/schema';
import { composePageTree, composeWithMaster } from './page-composition';

describe('composeWithMaster', () => {
  it('splices the page blocks in place of a root-level drop zone', () => {
    const masterTree: PageTree = {
      blocks: [{ block: 'header' }, { block: '__page_content__' }, { block: 'footer' }],
    };
    const pageTree: PageTree = { blocks: [{ block: 'hero', props: { title: 'Hi' } }] };

    expect(composeWithMaster(masterTree, pageTree)).toEqual({
      blocks: [{ block: 'header' }, { block: 'hero', props: { title: 'Hi' } }, { block: 'footer' }],
    });
  });

  it('splices the page blocks in place of a drop zone nested inside a slot', () => {
    const masterTree: PageTree = {
      blocks: [
        {
          block: 'layout',
          slots: {
            main: [{ block: 'header' }, { block: '__page_content__' }, { block: 'footer' }],
          },
        },
      ],
    };
    const pageTree: PageTree = {
      blocks: [
        { block: 'text', props: { body: 'a' } },
        { block: 'text', props: { body: 'b' } },
      ],
    };

    expect(composeWithMaster(masterTree, pageTree)).toEqual({
      blocks: [
        {
          block: 'layout',
          slots: {
            main: [
              { block: 'header' },
              { block: 'text', props: { body: 'a' } },
              { block: 'text', props: { body: 'b' } },
              { block: 'footer' },
            ],
          },
        },
      ],
    });
  });

  it('splicing in zero page blocks removes the drop zone entirely', () => {
    const masterTree: PageTree = { blocks: [{ block: 'header' }, { block: '__page_content__' }] };
    expect(composeWithMaster(masterTree, { blocks: [] })).toEqual({
      blocks: [{ block: 'header' }],
    });
  });

  it('leaves sibling nodes and other slots untouched', () => {
    const masterTree: PageTree = {
      blocks: [
        {
          block: 'two-columns',
          slots: {
            left: [{ block: '__page_content__' }],
            right: [{ block: 'sidebar' }],
          },
        },
      ],
    };
    const pageTree: PageTree = { blocks: [{ block: 'hero' }] };

    expect(composeWithMaster(masterTree, pageTree)).toEqual({
      blocks: [
        {
          block: 'two-columns',
          slots: {
            left: [{ block: 'hero' }],
            right: [{ block: 'sidebar' }],
          },
        },
      ],
    });
  });
});

describe('composePageTree', () => {
  it('returns the page tree unchanged when no master is resolved', () => {
    const pageTree: PageTree = { blocks: [{ block: 'hero' }] };
    expect(composePageTree(null, pageTree)).toBe(pageTree);
  });

  it('delegates to composeWithMaster when a master is resolved', () => {
    const masterTree: PageTree = { blocks: [{ block: '__page_content__' }] };
    const pageTree: PageTree = { blocks: [{ block: 'hero' }] };
    expect(composePageTree(masterTree, pageTree)).toEqual({ blocks: [{ block: 'hero' }] });
  });
});
