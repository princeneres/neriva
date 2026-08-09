import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DROP_ZONE_BLOCK } from '../modules/pages/page-tree.validation';
import { DB, type Database } from './database';
import { pageTemplates, systemSettings, tenants, type PageTree } from './schema';
import { DEFAULT_TENANT_ERC } from './seed.service';

export const MASTER_DEFAULT_ERC = 'master-default';
export const TEMPLATE_BLANK_ERC = 'template-blank';

// Well-known tenant setting resolved by pages/delivery when a page does not
// set its own master (spec 14). Kebab-cased to satisfy spec 07's key
// pattern (^[a-z][a-z0-9.-]*$), which rejects camelCase. Defined here
// (db layer) rather than in the page-templates module, following the same
// direction as DEFAULT_TENANT_ERC in seed.service.ts: modules import
// well-known db-seeded constants, not the other way around.
export const DEFAULT_MASTER_SETTING_KEY = 'page.default-master-template';

// Built from the native blocks catalog (native-blocks-seed.service.ts),
// which this service assumes is already seeded (registered after it in
// DbModule). nv-container/nv-heading/nv-paragraph's real prop keys (both
// use "text") already match what this tree references.
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
// page.default-master-template setting that new pages fall back to when
// they set no master of their own (spec 14). Idempotent by ERC; gated by
// SEED_NATIVE_BLOCKS=false (it depends on the same native blocks catalog).
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
