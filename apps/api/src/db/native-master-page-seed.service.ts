import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DROP_ZONE_BLOCK } from '../modules/pages/page-tree.validation';
import { DB, type Database } from './database';
import {
  blocks,
  pageTemplates,
  systemSettings,
  tenants,
  type BlockSlot,
  type PageTree,
} from './schema';
import { DEFAULT_TENANT_ERC } from './seed.service';

export const MASTER_DEFAULT_ERC = 'master-default';
export const TEMPLATE_BLANK_ERC = 'template-blank';
export const NATIVE_CHROME_BLOCK_ERCS = ['nv-container', 'nv-heading', 'nv-paragraph'] as const;

// Well-known tenant setting resolved by pages/delivery when a page does not
// set its own master (spec 14). Kebab-cased to satisfy spec 07's key
// pattern (^[a-z][a-z0-9.-]*$), which rejects camelCase. Defined here
// (db layer) rather than in the page-templates module, following the same
// direction as DEFAULT_TENANT_ERC in seed.service.ts: modules import
// well-known db-seeded constants, not the other way around.
export const DEFAULT_MASTER_SETTING_KEY = 'page.default-master-template';

interface NativeChromeBlockDefinition {
  erc: (typeof NATIVE_CHROME_BLOCK_ERCS)[number];
  name: string;
  category: string;
  description: string;
  propsSchema: Record<string, unknown>;
  slots: BlockSlot[];
}

// Minimal chrome blocks used to build the default master's header/footer.
// Self-contained here (rather than depending on a separate native blocks
// catalog) so the default master seeds independently of any other seed.
const NATIVE_CHROME_BLOCKS: NativeChromeBlockDefinition[] = [
  {
    erc: 'nv-container',
    name: 'Container',
    category: 'layout',
    description: 'Generic layout container that groups the block instances of its content slot',
    propsSchema: {
      type: 'object',
      title: 'Container',
      description: 'Generic layout container',
      additionalProperties: false,
      properties: {},
    },
    slots: [{ name: 'content' }],
  },
  {
    erc: 'nv-heading',
    name: 'Heading',
    category: 'content',
    description: 'A single heading line',
    propsSchema: {
      type: 'object',
      title: 'Heading',
      description: 'A single heading line',
      additionalProperties: false,
      properties: { text: { type: 'string', title: 'Text', description: 'Heading text' } },
      required: ['text'],
    },
    slots: [],
  },
  {
    erc: 'nv-paragraph',
    name: 'Paragraph',
    category: 'content',
    description: 'A single paragraph of text',
    propsSchema: {
      type: 'object',
      title: 'Paragraph',
      description: 'A single paragraph of text',
      additionalProperties: false,
      properties: { text: { type: 'string', title: 'Text', description: 'Paragraph text' } },
      required: ['text'],
    },
    slots: [],
  },
];

function masterDefaultTree(): PageTree {
  const year = new Date().getFullYear();
  return {
    blocks: [
      {
        block: 'nv-container',
        slots: {
          content: [
            { block: 'nv-heading', props: { text: 'Your Site' } },
            { block: 'nv-paragraph', props: { text: 'A site built with Neriva CMS' } },
          ],
        },
      },
      { block: DROP_ZONE_BLOCK },
      {
        block: 'nv-container',
        slots: {
          content: [{ block: 'nv-paragraph', props: { text: `© ${year} · Built with Neriva` } }],
        },
      },
    ],
  };
}

const TEMPLATE_BLANK_TREE: PageTree = { blocks: [] };

// Seeds the default Master Page template, a blank Standard template, and the
// tenant.default-master-template setting that new pages fall back to when
// they set no master of their own (spec 14). Idempotent by ERC; gated by
// SEED_NATIVE_BLOCKS=false.
@Injectable()
export class NativeMasterPageSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NativeMasterPageSeedService.name);

  constructor(@Inject(DB) private readonly db: Database) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.run();
  }

  // See DemoSeedService for why this polls: bootstrap hooks across modules
  // run concurrently, so the first-boot tenant seed may not have committed
  // yet when this hook starts.
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
    throw new Error('Default tenant not found, the master page seed requires the first-boot seed');
  }

  async run(): Promise<void> {
    if (process.env.SEED_NATIVE_BLOCKS === 'false') {
      this.logger.log('SEED_NATIVE_BLOCKS=false, skipping default master page seed');
      return;
    }
    const tenant = await this.resolveDefaultTenant();
    await this.db.transaction(async (tx) => {
      for (const block of NATIVE_CHROME_BLOCKS) {
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
            status: 'PUBLISHED',
          });
          this.logger.log(`Seeded native block "${block.name}"`);
        }
      }

      const masterExists =
        (
          await tx
            .select({ id: pageTemplates.id })
            .from(pageTemplates)
            .where(
              and(
                eq(pageTemplates.tenantId, tenant.id),
                eq(pageTemplates.externalReferenceCode, MASTER_DEFAULT_ERC),
              ),
            )
            .limit(1)
        ).length > 0;
      if (!masterExists) {
        await tx.insert(pageTemplates).values({
          tenantId: tenant.id,
          externalReferenceCode: MASTER_DEFAULT_ERC,
          name: 'Default Master',
          kind: 'MASTER',
          siteId: null,
          tree: masterDefaultTree(),
        });
        this.logger.log('Seeded page template "Default Master"');
      }

      const blankExists =
        (
          await tx
            .select({ id: pageTemplates.id })
            .from(pageTemplates)
            .where(
              and(
                eq(pageTemplates.tenantId, tenant.id),
                eq(pageTemplates.externalReferenceCode, TEMPLATE_BLANK_ERC),
              ),
            )
            .limit(1)
        ).length > 0;
      if (!blankExists) {
        await tx.insert(pageTemplates).values({
          tenantId: tenant.id,
          externalReferenceCode: TEMPLATE_BLANK_ERC,
          name: 'Blank page',
          kind: 'STANDARD',
          siteId: null,
          tree: TEMPLATE_BLANK_TREE,
        });
        this.logger.log('Seeded page template "Blank page"');
      }

      const settingExists =
        (
          await tx
            .select({ id: systemSettings.id })
            .from(systemSettings)
            .where(
              and(
                eq(systemSettings.tenantId, tenant.id),
                eq(systemSettings.key, DEFAULT_MASTER_SETTING_KEY),
              ),
            )
            .limit(1)
        ).length > 0;
      if (!settingExists) {
        // Idempotent upsert-if-absent: an admin who already changed this
        // setting must not have it silently reset on the next boot.
        await tx.insert(systemSettings).values({
          tenantId: tenant.id,
          key: DEFAULT_MASTER_SETTING_KEY,
          value: MASTER_DEFAULT_ERC,
        });
        this.logger.log(`Seeded system setting "${DEFAULT_MASTER_SETTING_KEY}"`);
      }
    });
  }
}
