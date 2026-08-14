import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DROP_ZONE_BLOCK } from '../modules/pages/page-tree.validation';
import { DB, type Database } from './database';
import { pageTemplates, tenants, type PageTree } from './schema';
import { DEFAULT_TENANT_ERC } from './seed.service';

export const MASTER_DEFAULT_ERC = 'master-default';
export const TEMPLATE_BLANK_ERC = 'template-blank';

// Built from the native blocks catalog (native-blocks-seed.service.ts),
// which this service assumes is already seeded (registered after it in
// DbModule). nv-header renders real, current site navigation (spec 12
// section 2/5 amendment) and the light/dark toggle on its own (spec 06
// dark-mode amendment); nv-footer mirrors it with a copyright line.
function masterDefaultTree(): PageTree {
  const year = new Date().getFullYear();
  return {
    blocks: [
      {
        block: 'nv-header',
        props: { siteName: 'Your Site', tagline: 'Built with Neriva' },
      },
      { block: DROP_ZONE_BLOCK },
      {
        block: 'nv-footer',
        props: { text: `<p>© ${year} Your Site. All rights reserved.</p>` },
      },
    ],
  };
}

const TEMPLATE_BLANK_TREE: PageTree = { blocks: [] };

// Seeds the default Master Page template (marked isDefault) and a blank
// Standard template. New pages that set no master of their own fall back
// to the tenant's isDefault MASTER template (spec 14). Idempotent by ERC;
// gated by SEED_NATIVE_BLOCKS=false (it depends on the same native blocks
// catalog).
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
          isDefault: true,
        });
        this.logger.log('Seeded page template "Default Master" as the tenant default');
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
    });
  }
}
