import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DB, type Database } from './database';
import {
  blocks,
  contentEntries,
  contentTypes,
  pages,
  sites,
  styleBooks,
  tenants,
  type BlockSlot,
  type ContentFieldDefinition,
  type PageTree,
} from './schema';
import { DEFAULT_TENANT_ERC } from './seed.service';

export const DEMO_SITE_ERC = 'demo-site';
export const DEMO_STYLE_BOOK_ERC = 'demo-style-book';
export const DEMO_PAGE_ERC = 'demo-home';
export const DEMO_CONTENT_TYPE_ERC = 'article';
export const DEMO_BLOCK_ERCS = ['hero', 'rich-text', 'two-columns', 'image'] as const;
export const DEMO_CONTENT_ENTRY_ERCS = [
  'article-hello-neriva',
  'article-blocks-explained',
] as const;

interface DemoBlockDefinition {
  erc: (typeof DEMO_BLOCK_ERCS)[number];
  name: string;
  category: string;
  description: string;
  propsSchema: Record<string, unknown>;
  slots: BlockSlot[];
}

// title/description on every schema node so generated prop forms read well.
const DEMO_BLOCKS: DemoBlockDefinition[] = [
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
  },
];

const DEMO_STYLE_BOOK_TOKENS: Record<string, string> = {
  'color-primary': '#cc3d47',
  'color-surface': '#faf9f7',
  'color-text': '#1a1917',
  'space-sm': '0.5rem',
  'space-md': '1rem',
  'space-lg': '2rem',
  'radius-md': '8px',
  'font-body': 'system-ui',
};

// Exported so tests can assert the tree is served back intact.
export const DEMO_PAGE_TREE: PageTree = {
  blocks: [
    {
      block: 'hero',
      props: {
        heading: 'Build pages from blocks',
        subheading:
          'This page was seeded on first boot so a fresh install starts with a working example.',
        ctaLabel: 'Open the admin',
        ctaUrl: '/admin',
      },
    },
    {
      block: 'two-columns',
      props: {},
      slots: {
        left: [
          {
            block: 'rich-text',
            props: {
              body: 'Blocks are typed components. Each block declares a JSON Schema of configurable props plus named slots, and a page is a JSON tree of block instances. Edit this page to see how the hero and these two columns are composed.',
            },
          },
        ],
        right: [
          {
            block: 'rich-text',
            props: {
              body: 'The look and feel comes from the style book. Design tokens such as color-primary and space-md reach blocks as CSS variables, so restyling the whole site means editing a single token set.',
            },
          },
        ],
      },
    },
  ],
};

const ARTICLE_FIELDS: ContentFieldDefinition[] = [
  { key: 'summary', label: 'Summary', type: 'text', required: true },
  { key: 'body', label: 'Body', type: 'richtext', required: true },
  { key: 'publishedOn', label: 'Published on', type: 'date', required: false },
];

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
      summary: 'A quick tour of what a fresh Neriva install gives you.',
      body: 'Neriva is a headless-first CMS. Everything you see in the admin, from this article to the demo home page, is also available through the REST API. This entry belongs to the Article content type, whose fields are defined as data, not code.',
      publishedOn: '2026-01-05',
    },
  },
  {
    erc: 'article-blocks-explained',
    title: 'Blocks explained',
    values: {
      summary: 'How pages are composed from typed, schema-validated blocks.',
      body: 'A block declares a JSON Schema for its props and a list of named slots. Pages reference blocks by their external reference code and are validated against those schemas on every save, so a page tree can never drift out of sync with its blocks.',
      publishedOn: '2026-01-12',
    },
  },
];

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
    });
  }
}
