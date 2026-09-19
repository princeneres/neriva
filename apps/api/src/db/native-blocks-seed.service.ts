import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DB, type Database } from './database';
import { blocks, tenants, type BlockSlot } from './schema';
import { DEFAULT_TENANT_ERC } from './seed.service';

export const NATIVE_BLOCK_ERCS = [
  'nv-header',
  'nv-footer',
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
  'nv-post-list',
  'nv-todo-list',
] as const;

interface NativeBlockDefinition {
  erc: (typeof NATIVE_BLOCK_ERCS)[number];
  name: string;
  category: string;
  description: string;
  propsSchema: Record<string, unknown>;
  slots: BlockSlot[];
  // The active native definition is versioned by this catalog. Existing
  // customizations remain untouched while rows that still use the native
  // baseline are promoted to its current HTML, CSS and JavaScript source.
  html: string | null;
  css: string | null;
  js?: string | null;
}

// The native component library (spec 12 section 2): the Liferay-style basic
// fragments every install starts from. Users learn the template syntax by
// reading and duplicating these, so the markup and css are the reference
// implementation: token variables with fallbacks, one root class per block,
// no required props so a freshly dropped block never fails validation.
// Exported so tests can assert every template passes the write-time rules.
export const NATIVE_BLOCKS: NativeBlockDefinition[] = [
  {
    erc: 'nv-header',
    name: 'Header',
    category: 'layout',
    description:
      'Site header with a brand, navigation built from the site’s own pages, and a light/dark toggle',
    propsSchema: {
      type: 'object',
      title: 'Header',
      description: 'Site header: brand, navigation and a light/dark toggle',
      additionalProperties: false,
      properties: {
        siteName: { type: 'string', title: 'Site name', description: 'Shown as the brand' },
        tagline: {
          type: 'string',
          title: 'Tagline',
          description: 'Optional short line next to the site name',
        },
        logoUrl: {
          type: 'string',
          title: 'Logo',
          description: 'Optional logo image; a default mark is shown until one is set',
        },
      },
    },
    slots: [],
    html: [
      '<header class="nv-header">',
      '  <div class="nv-header-inner">',
      '    <div class="nv-header-brand">',
      '      <img class="nv-header-logo" data-nv-image="logoUrl" alt="" />',
      '      <span class="nv-header-name" data-nv-text="siteName">Your Site</span>',
      '      <span class="nv-header-tagline" data-nv-text="tagline"></span>',
      '    </div>',
      '    <nav class="nv-header-nav" data-nv-nav="pages" aria-label="Primary">',
      '      <a href="/">Home</a>',
      '    </nav>',
      '    <label class="nv-theme-toggle-label" for="nv-theme-toggle" title="Toggle dark mode" aria-label="Toggle dark mode">',
      '      <input type="checkbox" id="nv-theme-toggle" class="nv-theme-toggle-input" />',
      '      <span class="nv-theme-toggle-icon" aria-hidden="true"></span>',
      '    </label>',
      '  </div>',
      '</header>',
    ].join('\n'),
    css: [
      '.nv-header { background: var(--nv-color-surface, #fff); color: var(--nv-color-text, #1a1917); border-bottom: 1px solid var(--nv-color-border, rgba(0, 0, 0, 0.08)); }',
      '.nv-header-inner { max-width: 72rem; margin: 0 auto; padding: var(--nv-space-md, 1rem) var(--nv-space-md, 1rem); display: flex; align-items: center; gap: var(--nv-space-lg, 2rem); flex-wrap: wrap; }',
      '.nv-header-brand { display: flex; align-items: center; gap: var(--nv-space-sm, 0.5rem); font-family: var(--nv-font-body, system-ui); }',
      '.nv-header-brand::before { content: "⚡"; font-size: 1.25rem; line-height: 1; color: var(--nv-color-primary, #cc3d47); }',
      '.nv-header-brand:has(.nv-header-logo[src]:not([src=""]))::before { display: none; }',
      '.nv-header-logo { display: block; width: 1.75rem; height: 1.75rem; border-radius: var(--nv-radius-md, 8px); object-fit: cover; }',
      '.nv-header-logo:not([src]), .nv-header-logo[src=""] { display: none; }',
      '.nv-header-name { font-weight: 700; font-size: 1.125rem; letter-spacing: -0.01em; }',
      '.nv-header-tagline { font-size: 0.875rem; opacity: 0.65; }',
      '.nv-header-tagline:empty { display: none; }',
      '.nv-header-nav { display: flex; gap: var(--nv-space-md, 1rem); flex-wrap: wrap; margin-left: auto; font-family: var(--nv-font-body, system-ui); font-size: 0.9375rem; }',
      '.nv-header-nav a { color: inherit; text-decoration: none; opacity: 0.8; }',
      '.nv-header-nav a:hover { opacity: 1; text-decoration: underline; }',
      '.nv-theme-toggle-input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }',
      '.nv-theme-toggle-label { display: inline-flex; align-items: center; justify-content: center; width: 2.25rem; height: 2.25rem; flex-shrink: 0; border-radius: 999px; border: 1px solid var(--nv-color-border, rgba(0, 0, 0, 0.12)); cursor: pointer; font-size: 1.0625rem; line-height: 1; }',
      '.nv-theme-toggle-icon::before { content: "🌙"; }',
      '.nv-theme-toggle-input:checked ~ .nv-theme-toggle-icon::before { content: "☀️"; }',
    ].join('\n'),
  },
  {
    erc: 'nv-footer',
    name: 'Footer',
    category: 'layout',
    description:
      'Site footer with a secondary navigation row and a copyright line, kept at the bottom of the page',
    propsSchema: {
      type: 'object',
      title: 'Footer',
      description: 'Site footer: secondary navigation and a copyright line',
      additionalProperties: false,
      properties: {
        text: {
          type: 'string',
          title: 'Copyright text',
          description: 'Rich text; allowed markup: p, br, b, strong, i, em, a, ul, ol, li',
        },
        pinToBottom: {
          type: 'string',
          title: 'Pin to the bottom of the page',
          description:
            'Choose "bottom" to keep the footer at the bottom edge of the screen when a page is too short to fill it, instead of leaving an empty gap below the footer. Choose "after-content" to always place the footer right under the last block. Leaving this empty uses "bottom".',
          enum: ['bottom', 'after-content'],
          default: 'bottom',
        },
      },
    },
    slots: [],
    // nv-pin-bottom is the runtime's bottom-pin marker (spec 12, page shell)
    // and is always present, because an unset prop interpolates to the empty
    // string and the pinned behavior is the default. The interpolated class
    // restates it, or becomes nv-pin-after-content, which cancels the pin.
    html: [
      '<footer class="nv-footer nv-pin-bottom nv-pin-{{pinToBottom}}">',
      '  <div class="nv-footer-inner">',
      '    <nav class="nv-footer-nav" data-nv-nav="pages" aria-label="Footer">',
      '      <a href="/">Home</a>',
      '    </nav>',
      '    <div class="nv-footer-copy" data-nv-rich="text">© Your Site. All rights reserved.</div>',
      '  </div>',
      '</footer>',
    ].join('\n'),
    css: [
      '.nv-footer { background: var(--nv-color-surface-alt, #f1efec); border-top: 1px solid var(--nv-color-border, rgba(0, 0, 0, 0.08)); color: var(--nv-color-text, #1a1917); font-family: var(--nv-font-body, system-ui); }',
      '.nv-footer-inner { max-width: 72rem; margin: 0 auto; padding: var(--nv-space-lg, 2rem) var(--nv-space-md, 1rem); display: flex; flex-direction: column; align-items: center; gap: var(--nv-space-sm, 0.5rem); text-align: center; }',
      '.nv-footer-nav { display: flex; gap: var(--nv-space-md, 1rem); flex-wrap: wrap; justify-content: center; font-size: 0.875rem; }',
      '.nv-footer-nav a { color: inherit; text-decoration: none; opacity: 0.75; }',
      '.nv-footer-nav a:hover { opacity: 1; text-decoration: underline; }',
      '.nv-footer-copy { font-size: 0.8125rem; opacity: 0.6; }',
      '.nv-footer-copy p { margin: 0; }',
    ].join('\n'),
  },
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
    html: '<h2 data-nv-tag="level" class="nv-heading nv-heading-{{level}}" data-nv-text="text">Heading</h2>',
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
      '.nv-card { overflow: hidden; border: 1px solid var(--nv-color-border, rgba(26, 25, 23, 0.12)); border-radius: var(--nv-radius-md, 8px); background: var(--nv-color-surface-alt, #faf9f7); box-shadow: 0 1px 3px rgba(26, 25, 23, 0.06); }',
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
  {
    erc: 'nv-post-list',
    name: 'Post List',
    category: 'content',
    description:
      'Searchable, paginated list of published content entries, read from the public delivery API',
    propsSchema: {
      type: 'object',
      title: 'Post List',
      description: 'Lists published content entries with search and pagination',
      additionalProperties: false,
      properties: {
        heading: {
          type: 'string',
          title: 'Heading',
          description: 'Optional title shown above the list',
        },
        contentType: {
          type: 'string',
          title: 'Content type',
          description:
            'Which content type to list, by reference: erc:<code> or its id. Example: erc:article',
        },
        pageSize: {
          type: 'number',
          title: 'Posts per page',
          description: 'How many posts to show before the next page link',
          minimum: 1,
          maximum: 24,
          default: 6,
        },
        showSearch: {
          type: 'boolean',
          title: 'Show the search box',
          description: 'Lets visitors filter the posts by words in the title or the fields',
          default: true,
        },
        summaryField: {
          type: 'string',
          title: 'Summary field',
          description: 'Field key holding the short text shown on the card',
          default: 'summary',
        },
        bodyField: {
          type: 'string',
          title: 'Body field',
          description: 'Field key holding the full text, revealed by "Read more"',
          default: 'body',
        },
        dateField: {
          type: 'string',
          title: 'Date field',
          description: 'Field key holding the publication date',
          default: 'publishedOn',
        },
        imageField: {
          type: 'string',
          title: 'Image field',
          description: 'Field key holding an image URL, used as the post thumbnail',
          default: 'thumbnail',
        },
        emptyText: {
          type: 'string',
          title: 'Empty message',
          description: 'Shown when no post matches. Leave empty for the default message',
        },
      },
    },
    slots: [],
    html: [
      '<section class="nv-post-list" data-nv-runtime="content-entries" data-nv-runtime-content-type="contentType" data-nv-runtime-page-size="pageSize" data-nv-runtime-summary-field="summaryField" data-nv-runtime-body-field="bodyField" data-nv-runtime-date-field="dateField" data-nv-runtime-image-field="imageField">',
      '  <header class="nv-post-list-head">',
      '    <h2 class="nv-post-list-title" data-nv-text="heading">Latest articles</h2>',
      '  </header>',
      '  <div class="nv-post-list-grid">',
      '    {{#each entries}}',
      '      <article class="nv-post-card">',
      '        <img class="nv-post-card-image" src="{{image}}" alt="">',
      '        <div class="nv-post-card-body"><time class="nv-post-card-date">{{date}}</time><h3 class="nv-post-card-title">{{title}}</h3><p class="nv-post-card-summary">{{summary}}</p></div>',
      '      </article>',
      '    {{/each}}',
      '  </div>',
      '</section>',
    ].join('\n'),
    css: [
      '.nv-post-list { max-width: 72rem; margin: 0 auto; padding: var(--nv-space-md, 1rem); color: var(--nv-color-text, #1a1917); font-family: var(--nv-font-body, system-ui); }',
      '.nv-post-list-head { margin-bottom: var(--nv-space-lg, 2rem); }',
      '.nv-post-list-title { margin: 0; font-size: 1.75rem; }',
      '.nv-post-list-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr)); gap: var(--nv-space-lg, 2rem); }',
      '.nv-post-card { overflow: hidden; border: 1px solid var(--nv-color-border, rgba(0, 0, 0, 0.1)); border-radius: var(--nv-radius-md, 8px); background: var(--nv-color-surface, #fff); }',
      '.nv-post-card-image { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }',
      '.nv-post-card-body { padding: var(--nv-space-md, 1rem); }',
      '.nv-post-card-date { font-size: 0.75rem; opacity: 0.55; }',
      '.nv-post-card-title { margin: 0.35rem 0; font-size: 1.125rem; }',
      '.nv-post-card-summary { margin: 0; line-height: 1.55; opacity: 0.8; }',
    ].join('\n'),
  },
  {
    erc: 'nv-todo-list',
    name: 'To Do List',
    category: 'content',
    description:
      'Interactive to do list over an Object: reads and writes real records through the Objects API',
    propsSchema: {
      type: 'object',
      title: 'To Do List',
      description: 'Adds, completes and removes records of an Object definition',
      additionalProperties: false,
      properties: {
        heading: {
          type: 'string',
          title: 'Heading',
          description: 'Optional title shown above the list',
        },
        objectDefinition: {
          type: 'string',
          title: 'Object',
          description:
            'Which object to read and write, by reference: erc:<code> or its id. Example: erc:demo-task',
        },
        titleField: {
          type: 'string',
          title: 'Title field',
          description: 'Field key holding the text of each item',
          default: 'title',
        },
        doneField: {
          type: 'string',
          title: 'Done field',
          description: 'Field key of the checkbox that marks an item complete',
          default: 'done',
        },
        priorityField: {
          type: 'string',
          title: 'Priority field',
          description: 'Field key of the priority list. Clear this to hide the priority control',
          default: 'priority',
        },
        dueDateField: {
          type: 'string',
          title: 'Due date field',
          description: 'Field key of the due date. Clear this to hide the due date control',
          default: 'dueDate',
        },
      },
    },
    slots: [],
    html: [
      '<section class="nv-todo" data-nv-runtime="object-records" data-nv-runtime-object-definition="objectDefinition" data-nv-runtime-title-field="titleField" data-nv-runtime-done-field="doneField" data-nv-runtime-priority-field="priorityField" data-nv-runtime-due-date-field="dueDateField">',
      '  <h2 class="nv-todo-title" data-nv-text="heading">Things to do</h2>',
      '  <form class="nv-todo-create" data-nv-todo-form>',
      '    <label class="nv-sr-only" for="nv-todo-title">New task</label>',
      '    <input id="nv-todo-title" class="nv-todo-input" data-nv-todo-title type="text" autocomplete="off" placeholder="Add a task" required>',
      '    <button class="nv-todo-add" type="submit">Add task</button>',
      '  </form>',
      '  <p class="nv-todo-empty" data-nv-todo-empty hidden>No tasks yet.</p>',
      '  <ul class="nv-todo-items">',
      '    {{#each records}}',
      '      <li class="nv-todo-item" data-nv-record-id="{{id}}" data-nv-done="{{done}}">',
      '        <label class="nv-todo-check"><input type="checkbox" data-nv-todo-toggle><span class="nv-sr-only">Mark {{title}} as done</span></label>',
      '        <span class="nv-todo-text">{{title}}</span><span class="nv-todo-tag">{{priority}}</span><time class="nv-todo-due">{{dueDate}}</time>',
      '        <button class="nv-todo-delete" type="button" data-nv-todo-delete aria-label="Remove {{title}}">Remove</button>',
      '      </li>',
      '    {{/each}}',
      '  </ul>',
      '</section>',
    ].join('\n'),
    css: [
      '.nv-todo { max-width: 40rem; margin: 0 auto; padding: var(--nv-space-md, 1rem); color: var(--nv-color-text, #1a1917); font-family: var(--nv-font-body, system-ui); }',
      '.nv-todo-title { margin: 0 0 var(--nv-space-md, 1rem); font-size: 1.5rem; }',
      '.nv-todo-create { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }',
      '.nv-todo-input { min-width: 0; flex: 1; border: 1px solid var(--nv-color-border, rgba(0, 0, 0, 0.16)); border-radius: var(--nv-radius-sm, 6px); padding: 0.625rem 0.75rem; color: inherit; background: var(--nv-color-surface, #fff); font: inherit; }',
      '.nv-todo-add, .nv-todo-delete { border: 0; border-radius: var(--nv-radius-sm, 6px); font: inherit; font-weight: 650; cursor: pointer; }',
      '.nv-todo-add { padding: 0.625rem 0.8rem; background: var(--nv-color-primary, #cc3d47); color: #fff; }',
      '.nv-todo-add:hover { filter: brightness(0.94); }',
      '.nv-todo-items { margin: 0; padding: 0; list-style: none; overflow: hidden; border: 1px solid var(--nv-color-border, rgba(0, 0, 0, 0.1)); border-radius: var(--nv-radius-md, 8px); background: var(--nv-color-surface, #fff); }',
      '.nv-todo-item { display: flex; gap: 0.75rem; align-items: center; padding: 0.7rem var(--nv-space-md, 1rem); border-bottom: 1px solid var(--nv-color-border, rgba(0, 0, 0, 0.06)); }',
      '.nv-todo-item:last-child { border-bottom: 0; }',
      '.nv-todo-text { flex: 1; min-width: 0; overflow-wrap: anywhere; }',
      '.nv-todo-item[data-nv-done="true"] .nv-todo-text { text-decoration: line-through; opacity: 0.55; }',
      '.nv-todo-tag { padding: 0.15rem 0.5rem; border-radius: 999px; background: var(--nv-color-surface-alt, #f1efec); font-size: 0.6875rem; font-weight: 700; }',
      '.nv-todo-due { font-size: 0.75rem; opacity: 0.55; }',
      '.nv-todo-delete { padding: 0.3rem 0.45rem; color: #9d2637; background: transparent; font-size: 0.75rem; }',
      '.nv-todo-delete:hover { background: rgba(157, 38, 55, 0.08); }',
      '.nv-todo-empty { margin: 0.75rem 0; color: var(--nv-color-text, #1a1917); opacity: 0.65; }',
      '.nv-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }',
    ].join('\n'),
    js: [
      '/*',
      ' * Object Records REST contract, executed through Neriva.request:',
      ' * GET    /object-definitions/:objectDefinition',
      ' * GET    /object-definitions/:objectDefinition/records?limit=100',
      ' * POST   /object-definitions/:objectDefinition/records',
      ' * PATCH  /object-records/:id',
      ' * DELETE /object-records/:id',
      ' *',
      ' * The generic object-records runtime performs the two reads before',
      ' * rendering {{#each records}}. This script owns the mutation requests.',
      " * Neriva.request validates each route against this Block's configured",
      ' * objectDefinition and sends it through the authenticated host API.',
      ' */',
      "const root = document.querySelector('.nv-todo');",
      'if (root) {',
      '  const objectDefinition = Neriva.props.objectDefinition;',
      '  const recordsPath = `/object-definitions/${encodeURIComponent(objectDefinition)}/records`;',
      "  const titleField = Neriva.props.titleField || 'title';",
      "  const doneField = Neriva.props.doneField || 'done';",
      "  const empty = root.querySelector('[data-nv-todo-empty]');",
      "  const items = root.querySelectorAll('[data-nv-record-id]');",
      '  if (empty) empty.hidden = items.length > 0;',
      "  root.querySelector('[data-nv-todo-form]')?.addEventListener('submit', (event) => {",
      '    event.preventDefault();',
      "    const input = root.querySelector('[data-nv-todo-title]');",
      "    const title = input instanceof HTMLInputElement ? input.value.trim() : '';",
      "    if (title === '') return;",
      "    Neriva.request({ method: 'POST', path: recordsPath, body: { data: { [titleField]: title } } });",
      "    if (input instanceof HTMLInputElement) input.value = '';",
      '  });',
      "  root.querySelectorAll('[data-nv-todo-toggle]').forEach((toggle) => {",
      "    const row = toggle.closest('[data-nv-record-id]');",
      '    if (!(toggle instanceof HTMLInputElement) || !row) return;',
      "    toggle.checked = row.dataset.nvDone === 'true';",
      "    toggle.addEventListener('change', () => Neriva.request({ method: 'PATCH', path: `/object-records/${encodeURIComponent(row.dataset.nvRecordId)}`, body: { data: { [doneField]: toggle.checked } } }));",
      '  });',
      "  root.querySelectorAll('[data-nv-todo-delete]').forEach((button) => {",
      "    button.addEventListener('click', () => { const row = button.closest('[data-nv-record-id]'); if (row) Neriva.request({ method: 'DELETE', path: `/object-records/${encodeURIComponent(row.dataset.nvRecordId)}` }); });",
      '  });',
      '}',
    ].join('\n'),
  },
];

// Seeds and evolves the native component library on boot. A row using the
// previous native baseline follows a new baseline; a custom row always keeps
// its active source. Empty active strings from the pre-Studio implementation
// are recovered as native source rather than shown as a misleading blank editor.
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
        const existing = (
          await tx
            .select({
              id: blocks.id,
              html: blocks.html,
              css: blocks.css,
              js: blocks.js,
              nativeHtml: blocks.nativeHtml,
              nativeCss: blocks.nativeCss,
              nativeJs: blocks.nativeJs,
              templateSource: blocks.templateSource,
            })
            .from(blocks)
            .where(and(eq(blocks.tenantId, tenant.id), eq(blocks.externalReferenceCode, block.erc)))
            .limit(1)
        )[0];
        if (!existing) {
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
            js: block.js ?? null,
            nativeHtml: block.html,
            nativeCss: block.css,
            nativeJs: block.js ?? null,
            templateSource: block.html !== null && block.css !== null ? 'NATIVE' : 'CUSTOM',
            status: 'PUBLISHED',
          });
          this.logger.log(`Seeded native block "${block.name}"`);
        } else if (block.html !== null && block.css !== null) {
          const hasNoPriorSource =
            (existing.html === null || existing.html.trim() === '') &&
            (existing.css === null || existing.css.trim() === '') &&
            (existing.js === null || existing.js.trim() === '');
          const matchesPriorNative =
            existing.nativeHtml !== null &&
            existing.nativeCss !== null &&
            existing.html === existing.nativeHtml &&
            existing.css === existing.nativeCss &&
            existing.js === existing.nativeJs;
          const useNativeSource =
            hasNoPriorSource || matchesPriorNative || existing.templateSource === 'NATIVE';
          await tx
            .update(blocks)
            .set({
              ...(useNativeSource
                ? { html: block.html, css: block.css, js: block.js ?? null }
                : {}),
              nativeHtml: block.html,
              nativeCss: block.css,
              nativeJs: block.js ?? null,
              templateSource: useNativeSource ? 'NATIVE' : 'CUSTOM',
              updatedAt: new Date(),
            })
            .where(and(eq(blocks.tenantId, tenant.id), eq(blocks.id, existing.id)));
          this.logger.log(`Synced native source for "${block.name}"`);
        }
      }
    });
  }
}
