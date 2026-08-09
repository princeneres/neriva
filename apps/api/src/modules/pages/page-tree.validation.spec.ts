import { describe, expect, it } from 'vitest';
import type { PageTree } from '../../db/schema';
import {
  collectBlockRefs,
  parsePageTree,
  validatePageTree,
  type BlockDefinition,
} from './page-tree.validation';

function definition(overrides: Partial<BlockDefinition> = {}): BlockDefinition {
  return {
    externalReferenceCode: 'hero',
    status: 'PUBLISHED',
    propsSchema: {
      type: 'object',
      properties: { title: { type: 'string' } },
      required: ['title'],
    },
    slots: [{ name: 'main' }],
    ...overrides,
  };
}

function defs(...definitions: BlockDefinition[]): Map<string, BlockDefinition> {
  return new Map(definitions.map((d) => [d.externalReferenceCode, d]));
}

describe('parsePageTree', () => {
  it('accepts a minimal valid tree', () => {
    const parsed = parsePageTree({ blocks: [{ block: 'hero', props: { title: 'Hi' } }] });
    expect(parsed.error).toBeNull();
    expect(parsed.tree).toEqual({ blocks: [{ block: 'hero', props: { title: 'Hi' } }] });
  });

  it('rejects non-object trees and unknown root keys', () => {
    expect(parsePageTree([]).error).toEqual({ pointer: '', message: 'tree must be an object' });
    expect(parsePageTree({ blocks: [], extra: 1 }).error?.message).toContain('blocks');
    expect(parsePageTree({ blocks: {} }).error).toEqual({
      pointer: 'blocks',
      message: 'blocks must be an array',
    });
  });

  it('points at the offending node for structural errors', () => {
    const parsed = parsePageTree({
      blocks: [{ block: 'hero', slots: { main: [{ block: 'a' }, { props: {} }] } }],
    });
    expect(parsed.error).toEqual({
      pointer: 'blocks[0].slots.main[1]',
      message: 'node.block must be a non-empty block ERC string',
    });
  });

  it('rejects unknown node keys and non-array slot values', () => {
    expect(parsePageTree({ blocks: [{ block: 'a', html: '<b>' }] }).error?.message).toContain(
      'unknown node key "html"',
    );
    expect(parsePageTree({ blocks: [{ block: 'a', slots: { main: {} } }] }).error).toEqual({
      pointer: 'blocks[0].slots.main',
      message: 'slot value must be an array',
    });
  });

  it('accepts whitelisted node styles and preserves them', () => {
    const node = {
      block: 'a',
      styles: { marginTop: 'token:space-lg', textColor: '#333', textAlign: 'center' },
    };
    const parsed = parsePageTree({ blocks: [node] });
    expect(parsed.error).toBeNull();
    expect(parsed.tree).toEqual({ blocks: [node] });
  });

  it('rejects a non-object styles value', () => {
    expect(parsePageTree({ blocks: [{ block: 'a', styles: ['x'] }] }).error).toEqual({
      pointer: 'blocks[0]',
      message: 'node.styles must be an object of style key to string value',
    });
  });

  it('rejects an unknown style key with the node pointer', () => {
    const parsed = parsePageTree({
      blocks: [{ block: 'a', slots: { main: [{ block: 'b', styles: { zIndex: '2' } }] } }],
    });
    expect(parsed.error).toEqual({
      pointer: 'blocks[0].slots.main[0]',
      message: 'unknown style key "zIndex"',
    });
  });

  it('rejects non-string style values and values over 100 characters', () => {
    expect(
      parsePageTree({ blocks: [{ block: 'a', styles: { marginTop: 2 } }] }).error?.message,
    ).toBe('style "marginTop" must be a string value');
    expect(
      parsePageTree({ blocks: [{ block: 'a', styles: { background: 'x'.repeat(101) } }] }).error
        ?.message,
    ).toBe('style "background" exceeds 100 characters');
    expect(
      parsePageTree({ blocks: [{ block: 'a', styles: { background: 'x'.repeat(100) } }] }).error,
    ).toBeNull();
  });
});

describe('collectBlockRefs', () => {
  it('collects every ERC recursively, deduplicated', () => {
    const tree: PageTree = {
      blocks: [
        { block: 'hero', slots: { main: [{ block: 'text' }, { block: 'hero' }] } },
        { block: 'footer' },
      ],
    };
    expect(collectBlockRefs(tree).sort()).toEqual(['footer', 'hero', 'text']);
  });
});

describe('validatePageTree', () => {
  it('accepts a tree matching definitions, props schemas and slots', () => {
    const tree: PageTree = {
      blocks: [
        {
          block: 'hero',
          props: { title: 'Welcome' },
          slots: {
            main: [{ block: 'text', props: { body: 'Hello' } }],
          },
        },
      ],
    };
    const blocksByErc = defs(
      definition(),
      definition({
        externalReferenceCode: 'text',
        propsSchema: { type: 'object', properties: { body: { type: 'string' } } },
        slots: [],
      }),
    );
    expect(validatePageTree(tree, blocksByErc)).toBeNull();
  });

  it('reports an unknown block ERC with its pointer', () => {
    const tree: PageTree = {
      blocks: [{ block: 'hero', props: { title: 'x' }, slots: { main: [{ block: 'ghost' }] } }],
    };
    expect(validatePageTree(tree, defs(definition()))).toEqual({
      pointer: 'blocks[0].slots.main[0]',
      message: 'unknown block "ghost"',
    });
  });

  it('reports props that violate the block schema', () => {
    const tree: PageTree = { blocks: [{ block: 'hero', props: { title: 42 } }] };
    const error = validatePageTree(tree, defs(definition()));
    expect(error?.pointer).toBe('blocks[0]');
    expect(error?.message).toContain('props do not match block "hero" schema');
  });

  it('treats missing props as an empty object against required fields', () => {
    const tree: PageTree = { blocks: [{ block: 'hero' }] };
    const error = validatePageTree(tree, defs(definition()));
    expect(error?.pointer).toBe('blocks[0]');
    expect(error?.message).toContain('title');
  });

  it('reports undeclared slot names', () => {
    const tree: PageTree = {
      blocks: [{ block: 'hero', props: { title: 'x' }, slots: { sidebar: [] } }],
    };
    expect(validatePageTree(tree, defs(definition()))).toEqual({
      pointer: 'blocks[0]',
      message: 'slot "sidebar" is not declared by block "hero"',
    });
  });

  it('requires PUBLISHED blocks only when requirePublished is set', () => {
    const tree: PageTree = { blocks: [{ block: 'hero', props: { title: 'x' } }] };
    const draft = defs(definition({ status: 'DRAFT' }));
    expect(validatePageTree(tree, draft)).toBeNull();
    const error = validatePageTree(tree, draft, { requirePublished: true });
    expect(error?.pointer).toBe('blocks[0]');
    expect(error?.message).toContain('DRAFT');
  });

  it('reports the first violation in document order at deep pointers', () => {
    const tree: PageTree = {
      blocks: [
        {
          block: 'hero',
          props: { title: 'ok' },
          slots: {
            main: [{ block: 'text', props: {} }, { block: 'text', props: {} }, { block: 'nope' }],
          },
        },
      ],
    };
    const blocksByErc = defs(
      definition(),
      definition({ externalReferenceCode: 'text', propsSchema: { type: 'object' }, slots: [] }),
    );
    expect(validatePageTree(tree, blocksByErc)).toEqual({
      pointer: 'blocks[0].slots.main[2]',
      message: 'unknown block "nope"',
    });
  });
});
