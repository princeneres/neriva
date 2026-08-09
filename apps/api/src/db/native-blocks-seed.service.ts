import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DB, type Database } from './database';
import { blocks, tenants, type BlockSlot } from './schema';
import { DEFAULT_TENANT_ERC } from './seed.service';

export const NATIVE_BLOCK_ERCS = [
  'nv-container',
  'nv-columns-2',
  'nv-columns-3',
  'nv-heading',
  'nv-paragraph',
  'nv-button',
  'nv-image',
  'nv-card',
  'nv-separator',
  'nv-spacer',
  'nv-video',
  'nv-html',
] as const;

interface NativeBlockDefinition {
  erc: (typeof NATIVE_BLOCK_ERCS)[number];
  name: string;
  category: string;
  description: string;
  propsSchema: Record<string, unknown>;
  slots: BlockSlot[];
  html: string;
  css: string;
}

// The native component library (spec 12 section 2): the Liferay-style basic
// fragments every install starts from. Users learn the template syntax by
// reading and duplicating these, so the markup and css are the reference
// implementation: token variables with fallbacks, one root class per block,
// no required props so a freshly dropped block never fails validation.
// Exported so tests can assert every template passes the write-time rules.
export const NATIVE_BLOCKS: NativeBlockDefinition[] = [
  {
    erc: 'nv-container',
    name: 'Container',
    category: 'layout',
    description: 'Full-width section with a centered content column and an optional background',
    propsSchema: {
      type: 'object',
      title: 'Container',
      description: 'Full-width section with a centered content column',
      additionalProperties: false,
      properties: {
        background: {
          type: 'string',
          title: 'Background',
          description: 'CSS background of the section, e.g. #f5f5f5 or a gradient',
        },
      },
    },
    slots: [{ name: 'content' }],
    html: [
      '<section class="nv-container" style="background: {{background}}">',
      '  <div class="nv-container-inner" data-nv-slot="content"></div>',
      '</section>',
    ].join('\n'),
    css: [
      '.nv-container { padding: var(--nv-space-lg, 2rem) var(--nv-space-md, 1rem); }',
      '.nv-container-inner { max-width: 72rem; margin: 0 auto; display: flex; flex-direction: column; gap: var(--nv-space-md, 1rem); }',
    ].join('\n'),
  },
  {
    erc: 'nv-columns-2',
    name: 'Two Columns',
    category: 'layout',
    description: 'Two equal columns that stack on narrow screens',
    propsSchema: {
      type: 'object',
      title: 'Two Columns',
      description: 'Two equal columns that stack on narrow screens',
      additionalProperties: false,
      properties: {},
    },
    slots: [{ name: 'left' }, { name: 'right' }],
    html: [
      '<div class="nv-columns-2">',
      '  <div class="nv-columns-2-col" data-nv-slot="left"></div>',
      '  <div class="nv-columns-2-col" data-nv-slot="right"></div>',
      '</div>',
    ].join('\n'),
    css: [
      '.nv-columns-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--nv-space-lg, 2rem); }',
      '@media (max-width: 40rem) { .nv-columns-2 { grid-template-columns: minmax(0, 1fr); } }',
      '.nv-columns-2-col { display: flex; flex-direction: column; gap: var(--nv-space-md, 1rem); min-width: 0; }',
    ].join('\n'),
  },
  {
    erc: 'nv-columns-3',
    name: 'Three Columns',
    category: 'layout',
    description: 'Three equal columns that stack on narrow screens',
    propsSchema: {
      type: 'object',
      title: 'Three Columns',
      description: 'Three equal columns that stack on narrow screens',
      additionalProperties: false,
      properties: {},
    },
    slots: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
    html: [
      '<div class="nv-columns-3">',
      '  <div class="nv-columns-3-col" data-nv-slot="a"></div>',
      '  <div class="nv-columns-3-col" data-nv-slot="b"></div>',
      '  <div class="nv-columns-3-col" data-nv-slot="c"></div>',
      '</div>',
    ].join('\n'),
    css: [
      '.nv-columns-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--nv-space-lg, 2rem); }',
      '@media (max-width: 56rem) { .nv-columns-3 { grid-template-columns: minmax(0, 1fr); } }',
      '.nv-columns-3-col { display: flex; flex-direction: column; gap: var(--nv-space-md, 1rem); min-width: 0; }',
    ].join('\n'),
  },
  {
    erc: 'nv-heading',
    name: 'Heading',
    category: 'basic',
    description: 'Section heading with a visual level from h1 to h4',
    propsSchema: {
      type: 'object',
      title: 'Heading',
      description: 'Section heading with a visual level from h1 to h4',
      additionalProperties: false,
      properties: {
        text: { type: 'string', title: 'Text', description: 'The heading text' },
        level: {
          type: 'string',
          title: 'Level',
          description: 'Visual size of the heading',
          enum: ['h1', 'h2', 'h3', 'h4'],
          default: 'h2',
        },
      },
    },
    slots: [],
    html: '<h2 class="nv-heading nv-heading-{{level}}" data-nv-text="text">Heading</h2>',
    css: [
      '.nv-heading { margin: 0; font-family: var(--nv-font-body, system-ui); color: var(--nv-color-text, #1a1917); line-height: 1.2; font-size: 2rem; font-weight: 700; letter-spacing: -0.01em; }',
      '.nv-heading-h1 { font-size: 2.75rem; letter-spacing: -0.02em; }',
      '.nv-heading-h2 { font-size: 2rem; }',
      '.nv-heading-h3 { font-size: 1.5rem; }',
      '.nv-heading-h4 { font-size: 1.25rem; }',
    ].join('\n'),
  },
  {
    erc: 'nv-paragraph',
    name: 'Paragraph',
    category: 'basic',
    description: 'A body of rich text: paragraphs, emphasis, links and lists',
    propsSchema: {
      type: 'object',
      title: 'Paragraph',
      description: 'A body of rich text',
      additionalProperties: false,
      properties: {
        text: {
          type: 'string',
          title: 'Text',
          description: 'Rich text; allowed markup: p, br, b, strong, i, em, a, ul, ol, li',
        },
      },
    },
    slots: [],
    html: '<div class="nv-paragraph" data-nv-rich="text">Write something great.</div>',
    css: [
      '.nv-paragraph { font-family: var(--nv-font-body, system-ui); color: var(--nv-color-text, #1a1917); line-height: 1.65; max-width: 42rem; }',
      '.nv-paragraph p { margin: 0 0 var(--nv-space-sm, 0.5rem); }',
      '.nv-paragraph p:last-child { margin-bottom: 0; }',
      '.nv-paragraph a { color: var(--nv-color-primary, #cc3d47); }',
    ].join('\n'),
  },
  {
    erc: 'nv-button',
    name: 'Button',
    category: 'basic',
    description: 'Call-to-action link styled as a button',
    propsSchema: {
      type: 'object',
      title: 'Button',
      description: 'Call-to-action link styled as a button',
      additionalProperties: false,
      properties: {
        label: { type: 'string', title: 'Label', description: 'Text shown inside the button' },
        url: { type: 'string', title: 'URL', description: 'Destination of the button' },
        variant: {
          type: 'string',
          title: 'Variant',
          description: 'Filled primary or outlined',
          enum: ['primary', 'outline'],
          default: 'primary',
        },
      },
    },
    slots: [],
    html: '<a class="nv-button nv-button-{{variant}}" data-nv-link="url" data-nv-text="label">Button</a>',
    css: [
      '.nv-button { display: inline-block; padding: 0.625rem 1.375rem; border-radius: var(--nv-radius-md, 8px); font-family: var(--nv-font-body, system-ui); font-weight: 600; font-size: 1rem; line-height: 1.4; text-decoration: none; cursor: pointer; transition: opacity 120ms ease; background: var(--nv-color-primary, #cc3d47); color: #fff; border: 1px solid var(--nv-color-primary, #cc3d47); }',
      '.nv-button:hover { opacity: 0.85; }',
      '.nv-button-outline { background: transparent; color: var(--nv-color-primary, #cc3d47); }',
    ].join('\n'),
  },
  {
    erc: 'nv-image',
    name: 'Image',
    category: 'media',
    description: 'An image with alternative text and an optional caption',
    propsSchema: {
      type: 'object',
      title: 'Image',
      description: 'An image with alternative text and an optional caption',
      additionalProperties: false,
      properties: {
        url: { type: 'string', title: 'URL', description: 'Address of the image file' },
        alt: {
          type: 'string',
          title: 'Alt text',
          description: 'Accessible description of the image',
        },
        caption: {
          type: 'string',
          title: 'Caption',
          description: 'Optional caption shown under the image',
        },
      },
    },
    slots: [],
    html: [
      '<figure class="nv-image">',
      '  <img class="nv-image-img" data-nv-image="url" data-nv-alt="alt" alt="">',
      '  <figcaption class="nv-image-caption" data-nv-text="caption"></figcaption>',
      '</figure>',
    ].join('\n'),
    css: [
      '.nv-image { margin: 0; }',
      '.nv-image-img { display: block; max-width: 100%; height: auto; border-radius: var(--nv-radius-md, 8px); }',
      '.nv-image-img:not([src]), .nv-image-img[src=""] { display: none; }',
      '.nv-image-caption { margin-top: var(--nv-space-sm, 0.5rem); font-family: var(--nv-font-body, system-ui); font-size: 0.875rem; color: var(--nv-color-text, #1a1917); opacity: 0.65; }',
      '.nv-image-caption:empty { display: none; }',
    ].join('\n'),
  },
  {
    erc: 'nv-card',
    name: 'Card',
    category: 'basic',
    description: 'Bordered card with an optional image, a title and rich text',
    propsSchema: {
      type: 'object',
      title: 'Card',
      description: 'Bordered card with an optional image, a title and rich text',
      additionalProperties: false,
      properties: {
        title: { type: 'string', title: 'Title', description: 'Card heading' },
        body: {
          type: 'string',
          title: 'Body',
          description: 'Rich text; allowed markup: p, br, b, strong, i, em, a, ul, ol, li',
        },
        imageUrl: {
          type: 'string',
          title: 'Image URL',
          description: 'Optional image shown at the top of the card',
        },
      },
    },
    slots: [],
    html: [
      '<article class="nv-card">',
      '  <img class="nv-card-image" data-nv-image="imageUrl" alt="">',
      '  <div class="nv-card-content">',
      '    <h3 class="nv-card-title" data-nv-text="title">Card title</h3>',
      '    <div class="nv-card-body" data-nv-rich="body"></div>',
      '  </div>',
      '</article>',
    ].join('\n'),
    css: [
      '.nv-card { overflow: hidden; border: 1px solid rgba(26, 25, 23, 0.12); border-radius: var(--nv-radius-md, 8px); background: var(--nv-color-surface, #faf9f7); box-shadow: 0 1px 3px rgba(26, 25, 23, 0.06); }',
      '.nv-card-image { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; }',
      '.nv-card-image:not([src]), .nv-card-image[src=""] { display: none; }',
      '.nv-card-content { padding: var(--nv-space-md, 1rem) var(--nv-space-md, 1rem) var(--nv-space-lg, 2rem); }',
      '.nv-card-title { margin: 0 0 var(--nv-space-sm, 0.5rem); font-family: var(--nv-font-body, system-ui); font-size: 1.25rem; color: var(--nv-color-text, #1a1917); }',
      '.nv-card-body { font-family: var(--nv-font-body, system-ui); line-height: 1.6; color: var(--nv-color-text, #1a1917); opacity: 0.85; }',
      '.nv-card-body p { margin: 0 0 var(--nv-space-sm, 0.5rem); }',
      '.nv-card-body p:last-child { margin-bottom: 0; }',
    ].join('\n'),
  },
  {
    erc: 'nv-separator',
    name: 'Separator',
    category: 'basic',
    description: 'Thin horizontal rule between sections',
    propsSchema: {
      type: 'object',
      title: 'Separator',
      description: 'Thin horizontal rule between sections',
      additionalProperties: false,
      properties: {},
    },
    slots: [],
    html: '<hr class="nv-separator">',
    css: '.nv-separator { border: none; height: 1px; margin: var(--nv-space-md, 1rem) 0; background: var(--nv-color-text, #1a1917); opacity: 0.15; }',
  },
  {
    erc: 'nv-spacer',
    name: 'Spacer',
    category: 'basic',
    description: 'Empty vertical space between blocks',
    propsSchema: {
      type: 'object',
      title: 'Spacer',
      description: 'Empty vertical space between blocks',
      additionalProperties: false,
      properties: {
        size: {
          type: 'string',
          title: 'Size',
          description: 'Height of the space',
          enum: ['sm', 'md', 'lg'],
          default: 'md',
        },
      },
    },
    slots: [],
    html: '<div class="nv-spacer nv-spacer-{{size}}" aria-hidden="true"></div>',
    css: [
      '.nv-spacer { height: var(--nv-space-md, 1rem); }',
      '.nv-spacer-sm { height: var(--nv-space-sm, 0.5rem); }',
      '.nv-spacer-md { height: var(--nv-space-md, 1rem); }',
      '.nv-spacer-lg { height: var(--nv-space-lg, 2rem); }',
    ].join('\n'),
  },
  {
    erc: 'nv-video',
    name: 'Video',
    category: 'media',
    description:
      'YouTube or Vimeo embed. The rendering engine turns the data-nv-embed hook into a sandboxed iframe for allowlisted hosts; templates never contain raw iframes.',
    propsSchema: {
      type: 'object',
      title: 'Video',
      description: 'YouTube or Vimeo embed rendered through the engine allowlist',
      additionalProperties: false,
      properties: {
        url: {
          type: 'string',
          title: 'Video URL',
          description: 'YouTube or Vimeo video URL',
        },
      },
    },
    slots: [],
    // data-nv-embed is an engine hook (spec 12): the API only stores it, the
    // renderer emits the sandboxed iframe for allowlisted hosts.
    html: '<div class="nv-video" data-nv-embed="url"></div>',
    css: '.nv-video { aspect-ratio: 16 / 9; width: 100%; overflow: hidden; border-radius: var(--nv-radius-md, 8px); background: var(--nv-color-text, #1a1917); }',
  },
  {
    erc: 'nv-html',
    name: 'Custom HTML',
    category: 'advanced',
    description:
      'Renders the html prop unescaped. Use with care: only trusted markup belongs here. The value is still sanitized with the write-time template rules (no scripts, iframes, event handlers or javascript: URLs).',
    propsSchema: {
      type: 'object',
      title: 'Custom HTML',
      description: 'Renders the html prop unescaped; only trusted markup belongs here',
      additionalProperties: false,
      properties: {
        html: {
          type: 'string',
          title: 'HTML',
          description: 'Raw markup rendered without escaping',
        },
      },
    },
    slots: [],
    // data-nv-html is an engine hook like data-nv-embed: the renderer inserts
    // the sanitized prop value unescaped.
    html: '<div class="nv-html" data-nv-html="html"></div>',
    css: '.nv-html { font-family: var(--nv-font-body, system-ui); color: var(--nv-color-text, #1a1917); }',
  },
];

// Seeds the native component library on boot (spec 12 section 2). Idempotent
// per block by ERC: existing rows are never retro-updated, so user edits to
// a native block survive restarts and upgrades only reach fresh installs.
@Injectable()
export class NativeBlocksSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NativeBlocksSeedService.name);

  constructor(@Inject(DB) private readonly db: Database) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.run();
  }

  // Nest fires the bootstrap hooks of one module concurrently, so
  // SeedService may not have committed the default tenant yet when this hook
  // starts (same wait as DemoSeedService).
  private async resolveDefaultTenant(): Promise<{ id: string }> {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const tenant = (
        await this.db
          .select()
          .from(tenants)
          .where(eq(tenants.externalReferenceCode, DEFAULT_TENANT_ERC))
          .limit(1)
      )[0];
      if (tenant) {
        return tenant;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(
      'Default tenant not found, the native blocks seed requires the first-boot seed',
    );
  }

  async run(): Promise<void> {
    if (process.env.SEED_NATIVE_BLOCKS === 'false') {
      this.logger.log('SEED_NATIVE_BLOCKS=false, skipping native blocks seed');
      return;
    }
    const tenant = await this.resolveDefaultTenant();
    await this.db.transaction(async (tx) => {
      for (const block of NATIVE_BLOCKS) {
        const exists =
          (
            await tx
              .select({ id: blocks.id })
              .from(blocks)
              .where(
                and(eq(blocks.tenantId, tenant.id), eq(blocks.externalReferenceCode, block.erc)),
              )
              .limit(1)
          ).length > 0;
        if (!exists) {
          await tx.insert(blocks).values({
            tenantId: tenant.id,
            externalReferenceCode: block.erc,
            name: block.name,
            category: block.category,
            description: block.description,
            propsSchema: block.propsSchema,
            slots: block.slots,
            html: block.html,
            css: block.css,
            status: 'PUBLISHED',
          });
          this.logger.log(`Seeded native block "${block.name}"`);
        }
      }
    });
  }
}
