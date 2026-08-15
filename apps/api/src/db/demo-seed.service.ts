import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { DB, type Database } from './database';
import {
  blocks,
  contentEntries,
  contentTypes,
  mediaFiles,
  mediaFolders,
  objectDefinitions,
  objectRecords,
  pages,
  sites,
  styleBooks,
  tenants,
  type BlockSlot,
  type ContentFieldDefinition,
  type ObjectFieldDefinition,
  type PageTree,
} from './schema';
import { DEFAULT_TENANT_ERC } from './seed.service';

export const DEMO_SITE_ERC = 'demo-site';
export const DEMO_STYLE_BOOK_ERC = 'demo-style-book';
export const DEMO_PAGE_ERC = 'demo-home';
export const DEMO_BLOG_PAGE_ERC = 'demo-blog-page';
export const DEMO_TODO_PAGE_ERC = 'demo-todo-page';
export const DEMO_CONTENT_TYPE_ERC = 'article';
export const DEMO_OBJECT_DEFINITION_ERC = 'demo-task';
export const DEMO_MEDIA_FOLDER_ERC = 'demo-media-folder';
export const DEMO_BLOCK_ERCS = ['hero', 'rich-text', 'two-columns', 'image', 'link-card'] as const;
export const DEMO_CONTENT_ENTRY_ERCS = [
  'article-hello-neriva',
  'article-blocks-explained',
  'article-objects-and-media',
  'article-style-book',
  'article-delivery-api',
  'article-roles',
] as const;
export const DEMO_OBJECT_RECORD_ERCS = [
  'demo-task-1',
  'demo-task-2',
  'demo-task-3',
  'demo-task-4',
] as const;
export const DEMO_MEDIA_FILE_ERCS = [
  'demo-cover-hello',
  'demo-cover-blocks',
  'demo-cover-objects',
  'demo-cover-style-book',
  'demo-cover-delivery',
  'demo-cover-roles',
] as const;

interface DemoBlockDefinition {
  erc: (typeof DEMO_BLOCK_ERCS)[number];
  name: string;
  category: string;
  description: string;
  propsSchema: Record<string, unknown>;
  slots: BlockSlot[];
  html: string;
  css: string;
}

// title/description on every schema node so generated prop forms read well.
// The html/css templates (spec 12) only reach fresh installs: seeding is
// idempotent by ERC and never retro-updates existing rows.
// Exported so tests can assert every template passes the write-time rules.
export const DEMO_BLOCKS: DemoBlockDefinition[] = [
  {
    erc: 'hero',
    name: 'Hero',
    category: 'content',
    description: 'Large introduction banner with an optional call to action',
    propsSchema: {
      type: 'object',
      title: 'Hero',
      description: 'Large introduction banner with an optional call to action',
      additionalProperties: false,
      properties: {
        heading: { type: 'string', title: 'Heading', description: 'Main headline of the banner' },
        subheading: {
          type: 'string',
          title: 'Subheading',
          description: 'Supporting line shown under the heading',
        },
        ctaLabel: {
          type: 'string',
          title: 'CTA label',
          description: 'Text of the call to action button',
        },
        ctaUrl: {
          type: 'string',
          title: 'CTA URL',
          description: 'Destination of the call to action button',
        },
      },
      required: ['heading'],
    },
    slots: [],
    html: [
      '<section class="demo-hero">',
      '  <h1 class="demo-hero-heading" data-nv-text="heading">Heading</h1>',
      '  <p class="demo-hero-subheading" data-nv-text="subheading"></p>',
      '  <a class="demo-hero-cta" data-nv-link="ctaUrl" data-nv-text="ctaLabel"></a>',
      '</section>',
    ].join('\n'),
    css: [
      '.demo-hero { padding: calc(var(--nv-space-lg, 2rem) * 2) var(--nv-space-lg, 2rem); background: var(--nv-color-surface, #faf9f7); text-align: center; border-radius: var(--nv-radius-md, 8px); }',
      '.demo-hero-heading { margin: 0; font-size: 2.5rem; line-height: 1.15; color: var(--nv-color-text, #1a1917); }',
      '.demo-hero-subheading { margin: var(--nv-space-md, 1rem) auto 0; max-width: 42rem; font-size: 1.125rem; color: var(--nv-color-text, #1a1917); opacity: 0.75; }',
      '.demo-hero-cta { display: inline-block; margin-top: var(--nv-space-lg, 2rem); padding: 0.75rem 1.5rem; background: var(--nv-color-primary, #cc3d47); color: #fff; text-decoration: none; border-radius: var(--nv-radius-md, 8px); font-weight: 600; }',
      '.demo-hero-cta:empty { display: none; }',
    ].join('\n'),
  },
  {
    erc: 'rich-text',
    name: 'Rich Text',
    category: 'content',
    description: 'A single body of text',
    propsSchema: {
      type: 'object',
      title: 'Rich Text',
      description: 'A single body of text',
      additionalProperties: false,
      properties: {
        body: { type: 'string', title: 'Body', description: 'Plain text in v1' },
      },
      required: ['body'],
    },
    slots: [],
    html: '<div class="demo-rich-text" data-nv-rich="body"></div>',
    css: '.demo-rich-text { max-width: 42rem; line-height: 1.6; color: var(--nv-color-text, #1a1917); font-family: var(--nv-font-body, system-ui); }',
  },
  {
    erc: 'two-columns',
    name: 'Two Columns',
    category: 'layout',
    description: 'Places the blocks of its two slots side by side',
    propsSchema: {
      type: 'object',
      title: 'Two Columns',
      description: 'Places the blocks of its two slots side by side',
      additionalProperties: false,
      properties: {},
    },
    slots: [{ name: 'left' }, { name: 'right' }],
    html: [
      '<div class="demo-two-columns">',
      '  <div class="demo-two-columns-col" data-nv-slot="left"></div>',
      '  <div class="demo-two-columns-col" data-nv-slot="right"></div>',
      '</div>',
    ].join('\n'),
    css: [
      '.demo-two-columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr)); gap: var(--nv-space-lg, 2rem); }',
      '.demo-two-columns-col { min-width: 0; }',
    ].join('\n'),
  },
  {
    erc: 'image',
    name: 'Image',
    category: 'media',
    description: 'A single image with alternative text',
    propsSchema: {
      type: 'object',
      title: 'Image',
      description: 'A single image with alternative text',
      additionalProperties: false,
      properties: {
        url: { type: 'string', title: 'URL', description: 'Address of the image file' },
        alt: {
          type: 'string',
          title: 'Alt text',
          description: 'Accessible description of the image',
        },
      },
      required: ['url', 'alt'],
    },
    slots: [],
    html: '<figure class="demo-image"><img class="demo-image-img" data-nv-image="url" data-nv-alt="alt" alt=""></figure>',
    css: [
      '.demo-image { margin: 0; }',
      '.demo-image-img { display: block; max-width: 100%; height: auto; border-radius: var(--nv-radius-md, 8px); }',
    ].join('\n'),
  },
  {
    erc: 'link-card',
    name: 'Link Card',
    category: 'content',
    description: 'A small card with a title, description and link, used to point at another page',
    propsSchema: {
      type: 'object',
      title: 'Link Card',
      description: 'A small card with a title, description and link, used to point at another page',
      additionalProperties: false,
      properties: {
        heading: { type: 'string', title: 'Heading', description: 'Title of the card' },
        description: {
          type: 'string',
          title: 'Description',
          description: 'Short supporting text',
        },
        linkLabel: { type: 'string', title: 'Link label', description: 'Text of the link' },
        linkUrl: { type: 'string', title: 'Link URL', description: 'Destination of the link' },
      },
      required: ['heading', 'linkLabel', 'linkUrl'],
    },
    slots: [],
    html: [
      '<article class="demo-link-card">',
      '  <h3 class="demo-link-card-heading" data-nv-text="heading">Heading</h3>',
      '  <p class="demo-link-card-description" data-nv-text="description"></p>',
      '  <a class="demo-link-card-link" data-nv-link="linkUrl" data-nv-text="linkLabel"></a>',
      '</article>',
    ].join('\n'),
    css: [
      '.demo-link-card { display: flex; flex-direction: column; gap: var(--nv-space-sm, 0.5rem); height: 100%; box-sizing: border-box; padding: var(--nv-space-lg, 2rem); background: var(--nv-color-surface, #faf9f7); border: 1px solid var(--nv-color-border, #e5e3df); border-radius: var(--nv-radius-md, 8px); }',
      '.demo-link-card-heading { margin: 0; font-size: 1.125rem; color: var(--nv-color-text, #1a1917); }',
      '.demo-link-card-description { margin: 0; flex: 1; font-size: 0.9375rem; color: var(--nv-color-text, #1a1917); opacity: 0.75; }',
      '.demo-link-card-link { align-self: flex-start; font-weight: 600; color: var(--nv-color-primary, #cc3d47); text-decoration: none; }',
      '.demo-link-card-link:hover { text-decoration: underline; }',
    ].join('\n'),
  },
];

const DEMO_STYLE_BOOK_TOKENS: Record<string, string> = {
  'color-primary': '#cc3d47',
  'color-surface': '#faf9f7',
  'color-surface-alt': '#f1efec',
  'color-text': '#1a1917',
  'color-border': '#e5e3df',
  'space-sm': '0.5rem',
  'space-md': '1rem',
  'space-lg': '2rem',
  'radius-md': '8px',
  'font-body': 'system-ui',
};

// A card that explains one concept, for the "how it fits together" grid.
function conceptCard(title: string, body: string): PageTree['blocks'][number] {
  return { block: 'nv-card', props: { title, body: `<p>${body}</p>` } };
}

// Exported so tests can assert the tree is served back intact. This is the
// site's actual home page (spec 13): it carries the welcome and "how Neriva
// fits together" content that used to live on the standalone admin dashboard,
// now as ordinary seeded page/block data instead of admin-only React UI, with
// a path into the demo pages below. Built from the native block library so it
// looks like what a user would build, and so reading its tree teaches the
// blocks they will actually use.
export const DEMO_PAGE_TREE: PageTree = {
  blocks: [
    {
      block: 'nv-container',
      props: { background: 'var(--nv-color-surface-alt, #f1efec)' },
      // Per-instance styles (spec 12 section 3) on top of the block's own
      // padding: the opening section earns more air than a body section.
      styles: { paddingTop: 'token:space-lg', paddingBottom: 'token:space-lg' },
      slots: {
        content: [
          { block: 'nv-heading', props: { text: 'Publish with Neriva', level: 'h1' } },
          {
            block: 'nv-paragraph',
            props: {
              text: '<p>A headless-first CMS: pages built from blocks, structured content, your own data objects, and a media library, all reachable through one REST API. Everything on this page is ordinary seeded content, so edit it or delete it freely.</p>',
            },
          },
          { block: 'nv-button', props: { label: 'Open the admin', url: '/admin/pages' } },
        ],
      },
    },
    {
      block: 'nv-container',
      props: {},
      slots: {
        content: [
          { block: 'nv-heading', props: { text: 'How Neriva fits together', level: 'h2' } },
          {
            block: 'nv-columns-3',
            props: {},
            slots: {
              a: [
                conceptCard(
                  'Sites',
                  'A site groups pages and content under one address. This demo is a site, and the default one is served at the web root.',
                ),
              ],
              b: [
                conceptCard(
                  'Pages and blocks',
                  'A page is a tree of block instances. A block declares typed props and named slots, so a page can never drift out of sync with the blocks it uses.',
                ),
              ],
              c: [
                conceptCard(
                  'Content',
                  'Define a content type once, then write entries against it. Every field is typed and validated the same way through the admin or the API.',
                ),
              ],
            },
          },
          { block: 'nv-spacer', props: { size: 'md' } },
          {
            block: 'nv-columns-3',
            props: {},
            slots: {
              a: [
                conceptCard(
                  'Objects',
                  'Your own data tables, defined as metadata rather than a migration. The to do list on this site is a real Object with typed fields.',
                ),
              ],
              b: [
                conceptCard(
                  'Media',
                  'Images and files behind a folder structure, served straight from this install. The thumbnails on the blog are seeded media files.',
                ),
              ],
              c: [
                conceptCard(
                  'Style Book',
                  'Colors, spacing, radii and typography live in one versioned token set that every block reads as CSS variables, including in dark mode.',
                ),
              ],
            },
          },
        ],
      },
    },
    {
      block: 'nv-container',
      props: { background: 'var(--nv-color-surface-alt, #f1efec)' },
      slots: {
        content: [
          { block: 'nv-heading', props: { text: 'Try it on this site', level: 'h2' } },
          {
            block: 'nv-paragraph',
            props: {
              text: '<p>Both pages below are built from the same blocks as this one, on real seeded data. Open them, then open the same page in the editor to see how they were composed.</p>',
            },
          },
          {
            block: 'nv-columns-2',
            props: {},
            slots: {
              left: [
                {
                  block: 'link-card',
                  props: {
                    heading: 'Blog',
                    description:
                      'Six posts of an Article content type, listed with search and pagination straight from the delivery API.',
                    linkLabel: 'Read the blog',
                    linkUrl: '/blog',
                  },
                },
              ],
              right: [
                {
                  block: 'link-card',
                  props: {
                    heading: 'To Do List',
                    description:
                      'A working list you can add to, complete and clear. Every change is a record written through the Objects API.',
                    linkLabel: 'Open the to do list',
                    linkUrl: '/todo',
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      block: 'nv-container',
      props: {},
      slots: {
        content: [
          { block: 'nv-separator', props: {} },
          {
            block: 'nv-paragraph',
            props: {
              text: '<p><b>Headless first.</b> Everything the admin does is also a REST endpoint: publishing this page, writing those posts, adding a to do item. The admin is just another API client, never a required step. See <a href="/admin/style-book">the Style Book</a> to restyle every page from one place.</p>',
            },
          },
        ],
      },
    },
  ],
};

// Exported so tests can assert the tree is served back intact. The listing
// itself is the nv-post-list block: it reads the published entries from the
// delivery API, so the posts are never copied into the page tree.
export const DEMO_BLOG_PAGE_TREE: PageTree = {
  blocks: [
    {
      block: 'nv-container',
      props: {},
      slots: {
        content: [
          { block: 'nv-heading', props: { text: 'Blog', level: 'h1' } },
          {
            block: 'nv-paragraph',
            props: {
              text: '<p>Every post below is a Content Entry of the <b>Article</b> type: a summary, a rich text body, a publication date and a thumbnail picked from the media library. Define the type once, then write as many entries as you like.</p>',
            },
          },
        ],
      },
    },
    {
      block: 'nv-post-list',
      styles: { paddingBottom: 'token:space-lg' },
      props: {
        heading: 'Latest posts',
        contentType: `erc:${DEMO_CONTENT_TYPE_ERC}`,
        pageSize: 4,
        showSearch: true,
      },
    },
    {
      block: 'nv-container',
      props: { background: 'var(--nv-color-surface-alt, #f1efec)' },
      slots: {
        content: [
          { block: 'nv-heading', props: { text: 'How this page works', level: 'h3' } },
          {
            block: 'nv-paragraph',
            props: {
              text: '<p>The list is a single block. It calls the public delivery API, which needs no token because it only ever serves published content:</p><ul><li><b>GET /public/sites/demo/content-entries</b> returns the published entries of this site, newest first.</li><li><b>q</b> filters by words in the title or the field values, which is what the search box sends.</li><li><b>limit</b> and <b>cursor</b> page through the results, which is what Previous and Next use.</li></ul><p>Point the block at another content type and it lists that instead, no code involved. <a href="/admin/content/entries">Write a post of your own</a> and it shows up here as soon as it is published.</p>',
            },
          },
        ],
      },
    },
  ],
};

// Exported so tests can assert the tree is served back intact. The list is
// the nv-todo-list block, which reads and writes the Task records through the
// Objects API, so the page tree holds no copy of the data.
export const DEMO_TODO_PAGE_TREE: PageTree = {
  blocks: [
    {
      block: 'nv-container',
      props: {},
      slots: {
        content: [
          { block: 'nv-heading', props: { text: 'To Do List', level: 'h1' } },
          {
            block: 'nv-paragraph',
            props: {
              text: '<p>This list is real. Tick an item, add one, remove one, then reload the page: the changes are still there, because each one is a record stored by Neriva rather than something kept in your browser.</p>',
            },
          },
        ],
      },
    },
    {
      block: 'nv-todo-list',
      styles: { paddingBottom: 'token:space-lg' },
      props: {
        heading: 'My to do list',
        objectDefinition: `erc:${DEMO_OBJECT_DEFINITION_ERC}`,
      },
    },
    {
      block: 'nv-container',
      props: { background: 'var(--nv-color-surface-alt, #f1efec)' },
      slots: {
        content: [
          { block: 'nv-heading', props: { text: 'How this was built', level: 'h3' } },
          {
            block: 'nv-paragraph',
            props: {
              text: '<p>With an <b>Object</b>, and no code. An Object is a data table you define as metadata instead of writing a migration: name it, give it typed fields, and Neriva validates every record against them. Nothing is created in the database schema at runtime, the records live as JSONB rows.</p><p>The Object behind this list is called <b>Task</b> and has four fields:</p><ul><li><b>title</b>, text, required. What the item says.</li><li><b>priority</b>, a pick list of Low, Medium and High, required. Shown as the tag on each row.</li><li><b>done</b>, true or false, required. The checkbox.</li><li><b>dueDate</b>, a date, optional. Left empty on some items to show an optional field.</li></ul>',
            },
          },
          { block: 'nv-heading', props: { text: 'The endpoints this list calls', level: 'h4' } },
          {
            block: 'nv-paragraph',
            props: {
              text: '<ul><li><b>GET /object-definitions/erc:demo-task/records</b> loads the items.</li><li><b>POST /object-definitions/erc:demo-task/records</b> adds one.</li><li><b>PATCH /object-records/:id</b> ticks or edits one. It replaces the whole payload, so the block sends the merged values.</li><li><b>DELETE /object-records/:id</b> removes one.</li></ul><p>The block also reads <b>GET /object-definitions/erc:demo-task</b> first, so it renders the fields the Object actually declares instead of assuming them. Rename a field or add an option and the list follows.</p><p>These are the authenticated management endpoints, the same ones the admin screens use, so the list is interactive while you are signed in and shows a short explanation to anonymous visitors. Public, anonymous reads are the delivery API, which serves published pages and content only.</p>',
            },
          },
          {
            block: 'nv-button',
            props: {
              label: 'Open the Task object',
              url: `/admin/objects/erc:${DEMO_OBJECT_DEFINITION_ERC}`,
              variant: 'outline',
            },
          },
        ],
      },
    },
  ],
};

// thumbnail is a text field holding a media URL: v1 content fields are only
// text, richtext, number, boolean and date (spec 04), so a picker-backed media
// field type does not exist yet. Paste the public URL of a file from the media
// library, which is what the seeded posts below do.
const ARTICLE_FIELDS: ContentFieldDefinition[] = [
  { key: 'summary', label: 'Summary', type: 'text', required: true },
  { key: 'body', label: 'Body', type: 'richtext', required: true },
  { key: 'publishedOn', label: 'Published on', type: 'date', required: false },
  { key: 'thumbnail', label: 'Thumbnail URL', type: 'text', required: false },
];

// Public URL of a seeded media file. Files are addressed by ERC (IDs in URLs
// accept a uuid or erc:<code>), so the seeded values stay static constants
// instead of depending on generated ids, and the path is relative so it works
// under any hostname (the web runtime proxies /public/media to the API).
function coverUrl(erc: (typeof DEMO_MEDIA_FILE_ERCS)[number]): string {
  return `/public/media/erc:${erc}/${erc}.svg`;
}

interface DemoEntryDefinition {
  erc: (typeof DEMO_CONTENT_ENTRY_ERCS)[number];
  title: string;
  values: Record<string, unknown>;
}

const DEMO_ENTRIES: DemoEntryDefinition[] = [
  {
    erc: 'article-hello-neriva',
    title: 'Hello Neriva',
    values: {
      summary: 'A quick tour of what a fresh install gives you.',
      body: 'Neriva is a headless-first CMS. Everything you see in the admin, from this post to the home page, is also available through the REST API. This entry belongs to the Article content type, whose fields are defined as data rather than code, which is why adding a thumbnail field to it took no migration.',
      publishedOn: '2026-01-05',
      thumbnail: coverUrl('demo-cover-hello'),
    },
  },
  {
    erc: 'article-blocks-explained',
    title: 'Blocks explained',
    values: {
      summary: 'How pages are composed from typed, schema-validated blocks.',
      body: 'A block declares a JSON Schema for its props and a list of named slots. Pages reference blocks by their external reference code and are validated against those schemas on every save, so a page tree can never drift out of sync with its blocks. Most blocks are an HTML and CSS template you can edit in the admin; a few, like the list you are reading this on, are rendered by the runtime because they read live data.',
      publishedOn: '2026-01-12',
      thumbnail: coverUrl('demo-cover-blocks'),
    },
  },
  {
    erc: 'article-objects-and-media',
    title: 'Objects and media',
    values: {
      summary: 'Your own data tables, and somewhere to keep your files.',
      body: 'Objects let you define your own data tables without writing a migration: the to do list on this site is one, with four typed fields. Media stores images and files behind a folder structure and serves them from this install. The thumbnail on this post is a seeded media file, referenced by its public URL from a plain text field.',
      publishedOn: '2026-01-19',
      thumbnail: coverUrl('demo-cover-objects'),
    },
  },
  {
    erc: 'article-style-book',
    title: 'One style book, every page',
    values: {
      summary: 'Restyle the whole site by editing a single token set.',
      body: 'Colors, spacing, radii and typography live in a versioned Style Book. Every block reads them as CSS variables, so changing the primary color once repaints every page, including the dark mode variant. Blocks that declare fallbacks keep working even before a style book is published.',
      publishedOn: '2026-01-26',
      thumbnail: coverUrl('demo-cover-style-book'),
    },
  },
  {
    erc: 'article-delivery-api',
    title: 'Reading your content over HTTP',
    values: {
      summary: 'The delivery API serves published content to anyone, with no token.',
      body: 'Pages, page lists, content entries and the site stylesheet are all available anonymously under /public, and only ever in their published state. Drafts are indistinguishable from content that does not exist. That is the same API this blog listing uses, which is why search and pagination work without signing in.',
      publishedOn: '2026-02-02',
      thumbnail: coverUrl('demo-cover-delivery'),
    },
  },
  {
    erc: 'article-roles',
    title: 'Who can publish what',
    values: {
      summary: 'Roles grant named actions on resource types, and deny by default.',
      body: 'A role maps resource types to actions such as read, create, update, delete and publish, scoped to the tenant or to one site. A fresh install ships an Administrator plus a Content Manager who can handle pages, content, media and object records without touching users, roles or settings. Anything not granted is denied.',
      publishedOn: '2026-02-09',
      thumbnail: coverUrl('demo-cover-roles'),
    },
  },
];

// ---- demo Object definition + records (spec 05) ----

const DEMO_TASK_FIELDS: ObjectFieldDefinition[] = [
  { key: 'title', label: 'Title', type: 'text', required: true },
  {
    key: 'priority',
    label: 'Priority',
    type: 'picklist',
    required: true,
    options: ['Low', 'Medium', 'High'],
  },
  { key: 'done', label: 'Done', type: 'boolean', required: true },
  { key: 'dueDate', label: 'Due date', type: 'date', required: false },
];

interface DemoTaskRecordDefinition {
  erc: (typeof DEMO_OBJECT_RECORD_ERCS)[number];
  data: Record<string, unknown>;
}

// A mix of open and done, every priority represented, and one item with no
// due date so an empty optional field is visible in the list.
const DEMO_TASK_RECORDS: DemoTaskRecordDefinition[] = [
  {
    erc: 'demo-task-1',
    data: { title: 'Write the launch post', priority: 'High', done: false, dueDate: '2026-02-20' },
  },
  {
    erc: 'demo-task-2',
    data: { title: 'Pick the brand colors', priority: 'Medium', done: false },
  },
  {
    erc: 'demo-task-3',
    data: { title: 'Invite a teammate', priority: 'Low', done: false, dueDate: '2026-03-02' },
  },
  {
    erc: 'demo-task-4',
    data: { title: 'Publish the demo site', priority: 'High', done: true, dueDate: '2026-01-05' },
  },
];

// ---- demo Media folder + files (spec 11) ----
// Real bytes are written to the configured storage backend (same convention
// as StorageService.generateKey/write) so these rows are indistinguishable
// from an uploaded file; only the entry point differs (a seed instead of a
// multipart request). This stays inside the db layer, like every other seed
// in this file, instead of importing MediaModule's internals.

interface DemoMediaFileDefinition {
  erc: (typeof DEMO_MEDIA_FILE_ERCS)[number];
  fileName: string;
  contentType: string;
  alt: string;
  svg: string;
}

// One family of covers, told apart by their accent and label, so the blog
// looks like a real blog without shipping binary fixtures. Labels stay plain
// words: they are interpolated into XML with no escaping.
function coverSvg(label: string, accent: string): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" role="img" aria-label="${label}">`,
    '<rect width="640" height="360" fill="#1a1917"/>',
    `<circle cx="548" cy="72" r="150" fill="${accent}" opacity="0.3"/>`,
    `<rect x="48" y="150" width="56" height="6" rx="3" fill="${accent}"/>`,
    `<text x="48" y="216" font-family="system-ui, sans-serif" font-size="36" font-weight="700" fill="#faf9f7">${label}</text>`,
    '</svg>',
  ].join('');
}

const DEMO_MEDIA_FILES: DemoMediaFileDefinition[] = [
  { erc: 'demo-cover-hello', label: 'Hello Neriva', accent: '#cc3d47' },
  { erc: 'demo-cover-blocks', label: 'Blocks', accent: '#d98324' },
  { erc: 'demo-cover-objects', label: 'Objects', accent: '#2f7d6f' },
  { erc: 'demo-cover-style-book', label: 'Style Book', accent: '#6b5bd2' },
  { erc: 'demo-cover-delivery', label: 'Delivery API', accent: '#2b6cb0' },
  { erc: 'demo-cover-roles', label: 'Roles', accent: '#a13d6b' },
].map((cover) => ({
  erc: cover.erc as (typeof DEMO_MEDIA_FILE_ERCS)[number],
  fileName: `${cover.erc}.svg`,
  contentType: 'image/svg+xml',
  alt: `Cover graphic for the "${cover.label}" example post`,
  svg: coverSvg(cover.label, cover.accent),
}));

// Mirrors StorageService.generateKey (modules/media/storage.service.ts).
function demoMediaStorageKey(fileName: string): string {
  const id = randomUUID();
  const ext = extname(fileName).toLowerCase();
  return `${id.slice(0, 2)}/${id}${ext}`;
}

// Mirrors StorageService.write.
async function writeDemoMediaBytes(storageKey: string, bytes: Buffer): Promise<void> {
  const path = join(resolve(process.env.MEDIA_STORAGE_DIR ?? './uploads'), storageKey);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}

// Mirrors StorageService.delete: best-effort compensation if the row insert
// that follows the byte write fails.
async function deleteDemoMediaBytes(storageKey: string): Promise<void> {
  try {
    await unlink(join(resolve(process.env.MEDIA_STORAGE_DIR ?? './uploads'), storageKey));
  } catch {
    // ignored, matches StorageService.delete
  }
}

// First-boot demo content so a new install does not greet the user with
// empty screens. Idempotent per item by ERC; disabled with SEED_DEMO=false.
@Injectable()
export class DemoSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DemoSeedService.name);

  constructor(@Inject(DB) private readonly db: Database) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.run();
  }

  // Nest fires the bootstrap hooks of one module concurrently (Promise.all),
  // so SeedService may not have committed the default tenant yet when this
  // hook starts. Waiting for the tenant row keeps the two seeds decoupled
  // without racing SeedService's own select-then-insert.
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
    throw new Error('Default tenant not found, the demo seed requires the first-boot seed');
  }

  async run(): Promise<void> {
    if (process.env.SEED_DEMO === 'false') {
      this.logger.log('SEED_DEMO=false, skipping demo content seed');
      return;
    }
    const tenant = await this.resolveDefaultTenant();
    await this.db.transaction(async (tx) => {
      let site = (
        await tx
          .select()
          .from(sites)
          .where(and(eq(sites.tenantId, tenant.id), eq(sites.externalReferenceCode, DEMO_SITE_ERC)))
          .limit(1)
      )[0];
      if (!site) {
        [site] = await tx
          .insert(sites)
          .values({
            tenantId: tenant.id,
            externalReferenceCode: DEMO_SITE_ERC,
            name: 'Demo Site',
            slug: 'demo',
            description:
              'Example site seeded on first boot to showcase pages, blocks and content. Safe to delete.',
          })
          .returning();
        this.logger.log('Seeded site "Demo Site"');
      }
      if (!site) {
        throw new Error('Failed to seed demo site');
      }

      const styleBookExists =
        (
          await tx
            .select({ id: styleBooks.id })
            .from(styleBooks)
            .where(
              and(
                eq(styleBooks.tenantId, tenant.id),
                eq(styleBooks.externalReferenceCode, DEMO_STYLE_BOOK_ERC),
              ),
            )
            .limit(1)
        ).length > 0;
      if (!styleBookExists) {
        await tx.insert(styleBooks).values({
          tenantId: tenant.id,
          externalReferenceCode: DEMO_STYLE_BOOK_ERC,
          name: 'Neriva Default',
          version: 1,
          tokens: DEMO_STYLE_BOOK_TOKENS,
          status: 'PUBLISHED',
        });
        this.logger.log('Seeded style book "Neriva Default"');
      }

      for (const block of DEMO_BLOCKS) {
        const blockExists =
          (
            await tx
              .select({ id: blocks.id })
              .from(blocks)
              .where(
                and(eq(blocks.tenantId, tenant.id), eq(blocks.externalReferenceCode, block.erc)),
              )
              .limit(1)
          ).length > 0;
        if (!blockExists) {
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
          this.logger.log(`Seeded block "${block.name}"`);
        }
      }

      const pageExists =
        (
          await tx
            .select({ id: pages.id })
            .from(pages)
            .where(
              and(eq(pages.tenantId, tenant.id), eq(pages.externalReferenceCode, DEMO_PAGE_ERC)),
            )
            .limit(1)
        ).length > 0;
      if (!pageExists) {
        await tx.insert(pages).values({
          tenantId: tenant.id,
          externalReferenceCode: DEMO_PAGE_ERC,
          siteId: site.id,
          title: 'Welcome to Neriva',
          path: '/',
          tree: DEMO_PAGE_TREE,
          status: 'PUBLISHED',
        });
        this.logger.log('Seeded page "Welcome to Neriva"');
      }

      const blogPageExists =
        (
          await tx
            .select({ id: pages.id })
            .from(pages)
            .where(
              and(
                eq(pages.tenantId, tenant.id),
                eq(pages.externalReferenceCode, DEMO_BLOG_PAGE_ERC),
              ),
            )
            .limit(1)
        ).length > 0;
      if (!blogPageExists) {
        await tx.insert(pages).values({
          tenantId: tenant.id,
          externalReferenceCode: DEMO_BLOG_PAGE_ERC,
          siteId: site.id,
          title: 'Blog',
          path: '/blog',
          tree: DEMO_BLOG_PAGE_TREE,
          status: 'PUBLISHED',
        });
        this.logger.log('Seeded page "Blog"');
      }

      let articleType = (
        await tx
          .select()
          .from(contentTypes)
          .where(
            and(
              eq(contentTypes.tenantId, tenant.id),
              eq(contentTypes.externalReferenceCode, DEMO_CONTENT_TYPE_ERC),
            ),
          )
          .limit(1)
      )[0];
      if (!articleType) {
        [articleType] = await tx
          .insert(contentTypes)
          .values({
            tenantId: tenant.id,
            externalReferenceCode: DEMO_CONTENT_TYPE_ERC,
            name: 'Article',
            description: 'Simple article with a summary, a body and a publication date',
            fields: ARTICLE_FIELDS,
          })
          .returning();
        this.logger.log('Seeded content type "Article"');
      }
      if (!articleType) {
        throw new Error('Failed to seed demo content type');
      }

      for (const entry of DEMO_ENTRIES) {
        const entryExists =
          (
            await tx
              .select({ id: contentEntries.id })
              .from(contentEntries)
              .where(
                and(
                  eq(contentEntries.tenantId, tenant.id),
                  eq(contentEntries.externalReferenceCode, entry.erc),
                ),
              )
              .limit(1)
          ).length > 0;
        if (!entryExists) {
          await tx.insert(contentEntries).values({
            tenantId: tenant.id,
            externalReferenceCode: entry.erc,
            contentTypeId: articleType.id,
            siteId: site.id,
            title: entry.title,
            values: entry.values,
            status: 'PUBLISHED',
          });
          this.logger.log(`Seeded content entry "${entry.title}"`);
        }
      }

      let taskDefinition = (
        await tx
          .select()
          .from(objectDefinitions)
          .where(
            and(
              eq(objectDefinitions.tenantId, tenant.id),
              eq(objectDefinitions.externalReferenceCode, DEMO_OBJECT_DEFINITION_ERC),
            ),
          )
          .limit(1)
      )[0];
      if (!taskDefinition) {
        [taskDefinition] = await tx
          .insert(objectDefinitions)
          .values({
            tenantId: tenant.id,
            externalReferenceCode: DEMO_OBJECT_DEFINITION_ERC,
            name: 'Task',
            pluralName: 'Tasks',
            description:
              'A simple to-do item, seeded to show how Objects let you define your own data tables without code.',
            fields: DEMO_TASK_FIELDS,
          })
          .returning();
        this.logger.log('Seeded object definition "Task"');
      }
      if (!taskDefinition) {
        throw new Error('Failed to seed demo object definition');
      }

      for (const record of DEMO_TASK_RECORDS) {
        const recordExists =
          (
            await tx
              .select({ id: objectRecords.id })
              .from(objectRecords)
              .where(
                and(
                  eq(objectRecords.tenantId, tenant.id),
                  eq(objectRecords.externalReferenceCode, record.erc),
                ),
              )
              .limit(1)
          ).length > 0;
        if (!recordExists) {
          await tx.insert(objectRecords).values({
            tenantId: tenant.id,
            externalReferenceCode: record.erc,
            objectDefinitionId: taskDefinition.id,
            data: record.data,
          });
          this.logger.log(`Seeded object record "${String(record.data.title)}"`);
        }
      }

      const todoPageExists =
        (
          await tx
            .select({ id: pages.id })
            .from(pages)
            .where(
              and(
                eq(pages.tenantId, tenant.id),
                eq(pages.externalReferenceCode, DEMO_TODO_PAGE_ERC),
              ),
            )
            .limit(1)
        ).length > 0;
      if (!todoPageExists) {
        await tx.insert(pages).values({
          tenantId: tenant.id,
          externalReferenceCode: DEMO_TODO_PAGE_ERC,
          siteId: site.id,
          title: 'To Do List',
          path: '/todo',
          tree: DEMO_TODO_PAGE_TREE,
          status: 'PUBLISHED',
        });
        this.logger.log('Seeded page "To Do List"');
      }

      let mediaFolder = (
        await tx
          .select()
          .from(mediaFolders)
          .where(
            and(
              eq(mediaFolders.tenantId, tenant.id),
              eq(mediaFolders.externalReferenceCode, DEMO_MEDIA_FOLDER_ERC),
            ),
          )
          .limit(1)
      )[0];
      if (!mediaFolder) {
        [mediaFolder] = await tx
          .insert(mediaFolders)
          .values({
            tenantId: tenant.id,
            externalReferenceCode: DEMO_MEDIA_FOLDER_ERC,
            name: 'Demo Media',
            parentId: null,
            siteId: null,
          })
          .returning();
        this.logger.log('Seeded media folder "Demo Media"');
      }
      if (!mediaFolder) {
        throw new Error('Failed to seed demo media folder');
      }

      for (const file of DEMO_MEDIA_FILES) {
        const fileExists =
          (
            await tx
              .select({ id: mediaFiles.id })
              .from(mediaFiles)
              .where(
                and(
                  eq(mediaFiles.tenantId, tenant.id),
                  eq(mediaFiles.externalReferenceCode, file.erc),
                ),
              )
              .limit(1)
          ).length > 0;
        if (!fileExists) {
          const bytes = Buffer.from(file.svg, 'utf8');
          const storageKey = demoMediaStorageKey(file.fileName);
          await writeDemoMediaBytes(storageKey, bytes);
          try {
            await tx.insert(mediaFiles).values({
              tenantId: tenant.id,
              externalReferenceCode: file.erc,
              folderId: mediaFolder.id,
              fileName: file.fileName,
              contentType: file.contentType,
              sizeBytes: bytes.length,
              storageKey,
              alt: file.alt,
            });
          } catch (error) {
            await deleteDemoMediaBytes(storageKey);
            throw error;
          }
          this.logger.log(`Seeded media file "${file.fileName}"`);
        }
      }
    });
  }
}
