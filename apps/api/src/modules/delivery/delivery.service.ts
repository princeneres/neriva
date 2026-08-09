import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gt, inArray } from 'drizzle-orm';
import { clampLimit, decodeCursor, encodeCursor } from '../../common/pagination';
import { DB, type Database } from '../../db/database';
import {
  blocks,
  pages,
  sites,
  styleBooks,
  tenants,
  type BlockSlot,
  type PageTree,
} from '../../db/schema';
import { DEFAULT_TENANT_ERC } from '../../db/seed.service';
import { PageTemplatesService } from '../page-templates/page-templates.service';
import { composePageTree } from '../pages/page-composition';
import { collectBlockRefs } from '../pages/page-tree.validation';

export interface DeliveredBlock {
  name: string;
  category: string | null;
  slots: BlockSlot[];
}

export interface DeliveredPageView {
  site: { name: string; slug: string };
  page: { title: string; path: string; tree: PageTree; updatedAt: Date };
  blocks: Record<string, DeliveredBlock>;
}

export interface DeliveredPageListItem {
  title: string;
  path: string;
  updatedAt: Date;
}

// DRAFT/ARCHIVED pages and non-existent paths share this detail so they are
// indistinguishable to anonymous visitors (spec 10, no information leaks).
const PAGE_NOT_FOUND_DETAIL = 'No published page at this path';

// Local copy of the spec 06 token rendering (--nv- prefix on :root). The
// stylebook module keeps its own; modules never import each other's
// internals. Names are sorted so the output is deterministic.
function renderCss(tokens: Record<string, string>): string {
  const lines = Object.entries(tokens)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `  --nv-${name}: ${value};`);
  if (lines.length === 0) {
    return ':root {\n}\n';
  }
  return `:root {\n${lines.join('\n')}\n}\n`;
}

@Injectable()
export class DeliveryService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly pageTemplatesService: PageTemplatesService,
  ) {}

  // v1 ships single-tenant deploys; delivery always targets the default
  // tenant, the same way login does (spec 10).
  private async resolveTenantId(): Promise<string> {
    const tenant = (
      await this.db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.externalReferenceCode, DEFAULT_TENANT_ERC))
        .limit(1)
    )[0];
    if (!tenant) {
      throw new NotFoundException({ detail: 'Default tenant is not provisioned' });
    }
    return tenant.id;
  }

  private async getSiteBySlug(
    tenantId: string,
    slug: string,
  ): Promise<{ id: string; name: string; slug: string }> {
    const site = (
      await this.db
        .select({ id: sites.id, name: sites.name, slug: sites.slug })
        .from(sites)
        .where(and(eq(sites.tenantId, tenantId), eq(sites.slug, slug)))
        .limit(1)
    )[0];
    if (!site) {
      throw new NotFoundException({ detail: `Site ${slug} not found` });
    }
    return site;
  }

  async getPage(slug: string, path: string): Promise<DeliveredPageView> {
    const tenantId = await this.resolveTenantId();
    const site = await this.getSiteBySlug(tenantId, slug);

    const page = (
      await this.db
        .select()
        .from(pages)
        .where(
          and(
            eq(pages.tenantId, tenantId),
            eq(pages.siteId, site.id),
            eq(pages.path, path),
            eq(pages.status, 'PUBLISHED'),
          ),
        )
        .limit(1)
    )[0];
    if (!page) {
      throw new NotFoundException({ detail: PAGE_NOT_FOUND_DETAIL });
    }

    // Master resolution (spec 14): the page's own masterPageTemplateId ->
    // the tenant default setting -> the oldest MASTER template -> none.
    const master = await this.pageTemplatesService.findMasterForPage(tenantId, page);
    const composedTree = composePageTree(master?.tree ?? null, page.tree);

    // The tree was validated against PUBLISHED blocks when the page was
    // published (and the master template validated on its own write); the
    // map entry is present for every block row that still exists, whatever
    // its current status (spec 10). collectBlockRefs on the composed tree
    // already unions the page's own refs with the master's.
    const refs = collectBlockRefs(composedTree);
    const blockMap: Record<string, DeliveredBlock> = {};
    if (refs.length > 0) {
      const rows = await this.db
        .select({
          externalReferenceCode: blocks.externalReferenceCode,
          name: blocks.name,
          category: blocks.category,
          slots: blocks.slots,
        })
        .from(blocks)
        .where(and(eq(blocks.tenantId, tenantId), inArray(blocks.externalReferenceCode, refs)));
      for (const row of rows) {
        blockMap[row.externalReferenceCode] = {
          name: row.name,
          category: row.category,
          slots: row.slots,
        };
      }
    }

    return {
      site: { name: site.name, slug: site.slug },
      page: { title: page.title, path: page.path, tree: composedTree, updatedAt: page.updatedAt },
      blocks: blockMap,
    };
  }

  async listPages(
    slug: string,
    params: { limit?: number; cursor?: string },
  ): Promise<{ items: DeliveredPageListItem[]; nextCursor: string | null; limit: number }> {
    const tenantId = await this.resolveTenantId();
    const site = await this.getSiteBySlug(tenantId, slug);

    const limit = clampLimit(params.limit);
    const conditions = [
      eq(pages.tenantId, tenantId),
      eq(pages.siteId, site.id),
      eq(pages.status, 'PUBLISHED'),
      params.cursor ? gt(pages.id, decodeCursor(params.cursor).id) : undefined,
    ];
    const rows = await this.db
      .select({ id: pages.id, title: pages.title, path: pages.path, updatedAt: pages.updatedAt })
      .from(pages)
      .where(and(...conditions))
      .orderBy(asc(pages.id))
      .limit(limit + 1);
    const window = rows.slice(0, limit);
    const last = window[window.length - 1];
    const nextCursor = rows.length > limit && last ? encodeCursor(last.id) : null;
    const items = window.map((row) => ({
      title: row.title,
      path: row.path,
      updatedAt: row.updatedAt,
    }));
    return { items, nextCursor, limit };
  }

  // CSS variables of the tenant's most recently published Style Book;
  // empty :root {} when none exists (spec 10).
  async renderStyleCss(slug: string): Promise<string> {
    const tenantId = await this.resolveTenantId();
    await this.getSiteBySlug(tenantId, slug);

    const latest = (
      await this.db
        .select({ tokens: styleBooks.tokens })
        .from(styleBooks)
        .where(and(eq(styleBooks.tenantId, tenantId), eq(styleBooks.status, 'PUBLISHED')))
        .orderBy(desc(styleBooks.updatedAt))
        .limit(1)
    )[0];
    return renderCss(latest?.tokens ?? {});
  }
}
