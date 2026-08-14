import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, gt, ilike, inArray, lt, or, sql, type SQL } from 'drizzle-orm';
import { parseEntityRef } from '../../common/entity-ref';
import { clampLimit, decodeCursor, encodeCursor } from '../../common/pagination';
import { renderTokensCss } from '../../common/style-tokens';
import { DB, type Database } from '../../db/database';
import {
  blocks,
  contentEntries,
  contentTypes,
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
import { SystemSettingsService } from '../system/system-settings.service';

export interface DeliveredSiteNavPage {
  title: string;
  path: string;
}

export interface DeliveredSite {
  name: string;
  slug: string;
}

// Cap on the auto-generated header/footer nav (spec 10); a real sitemap
// belongs to a future navigation-menu feature, not the delivery response.
const NAV_PAGE_LIMIT = 50;

export interface DeliveredBlock {
  name: string;
  category: string | null;
  slots: BlockSlot[];
  html: string | null;
  css: string | null;
}

// Spec 13: well-known system setting holding the default site slug.
export const DEFAULT_SITE_SETTING_KEY = 'site.default';

export interface DeliveredPageView {
  // pages: the site's own published pages (title/path only), for a
  // header/footer block's data-nv-nav to render real navigation without a
  // second request.
  site: DeliveredSite & { pages: DeliveredSiteNavPage[] };
  page: { title: string; path: string; tree: PageTree; updatedAt: Date };
  blocks: Record<string, DeliveredBlock>;
}

export interface DeliveredPageListItem {
  title: string;
  path: string;
  updatedAt: Date;
}

export interface DeliveredContentEntry {
  id: string;
  externalReferenceCode: string;
  title: string;
  // The content type's ERC, the stable handle a website templates against.
  contentType: string;
  values: Record<string, unknown>;
  updatedAt: Date;
}

// Postgres treats \, % and _ as special inside a LIKE/ILIKE pattern
// (backslash is the default escape character); a raw search term must have
// all three escaped so it matches as a literal substring instead of a
// wildcard pattern.
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// DRAFT/ARCHIVED pages and non-existent paths share this detail so they are
// indistinguishable to anonymous visitors (spec 10, no information leaks).
const PAGE_NOT_FOUND_DETAIL = 'No published page at this path';

@Injectable()
export class DeliveryService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly settingsService: SystemSettingsService,
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

  // Spec 13 resolution order: the site.default setting when its slug
  // exists, otherwise the oldest site; 404 when no sites exist at all.
  async getDefaultSite(): Promise<DeliveredSite> {
    const tenantId = await this.resolveTenantId();

    const configuredSlug = await this.configuredDefaultSlug(tenantId);
    if (configuredSlug) {
      const configured = (
        await this.db
          .select({ name: sites.name, slug: sites.slug })
          .from(sites)
          .where(and(eq(sites.tenantId, tenantId), eq(sites.slug, configuredSlug)))
          .limit(1)
      )[0];
      if (configured) {
        return configured;
      }
    }

    const oldest = (
      await this.db
        .select({ name: sites.name, slug: sites.slug })
        .from(sites)
        .where(eq(sites.tenantId, tenantId))
        .orderBy(asc(sites.createdAt), asc(sites.id))
        .limit(1)
    )[0];
    if (!oldest) {
      throw new NotFoundException({ detail: 'No sites exist' });
    }
    return oldest;
  }

  private async configuredDefaultSlug(tenantId: string): Promise<string | null> {
    try {
      const setting = await this.settingsService.getByKey(tenantId, DEFAULT_SITE_SETTING_KEY);
      return typeof setting.value === 'string' ? setting.value : null;
    } catch (error) {
      if (error instanceof NotFoundException) {
        return null;
      }
      throw error;
    }
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
          html: blocks.html,
          css: blocks.css,
        })
        .from(blocks)
        .where(and(eq(blocks.tenantId, tenantId), inArray(blocks.externalReferenceCode, refs)));
      for (const row of rows) {
        blockMap[row.externalReferenceCode] = {
          name: row.name,
          category: row.category,
          slots: row.slots,
          html: row.html,
          css: row.css,
        };
      }
    }

    const navPages = await this.db
      .select({ title: pages.title, path: pages.path })
      .from(pages)
      .where(
        and(eq(pages.tenantId, tenantId), eq(pages.siteId, site.id), eq(pages.status, 'PUBLISHED')),
      )
      .orderBy(asc(pages.path))
      .limit(NAV_PAGE_LIMIT);

    return {
      site: { name: site.name, slug: site.slug, pages: navPages },
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

  // Resolves a content type reference without leaking its existence: the
  // public listing turns a miss into an empty page instead of a 404.
  private async findContentTypeIdByRef(tenantId: string, ref: string): Promise<string | null> {
    const parsed = parseEntityRef(ref);
    const match =
      parsed.kind === 'id'
        ? eq(contentTypes.id, parsed.value)
        : eq(contentTypes.externalReferenceCode, parsed.value);
    const row = (
      await this.db
        .select({ id: contentTypes.id })
        .from(contentTypes)
        .where(and(eq(contentTypes.tenantId, tenantId), match))
        .limit(1)
    )[0];
    return row?.id ?? null;
  }

  // PUBLISHED entries attached to this site, newest first (spec 10). Ids are
  // UUIDv7 and therefore time-ordered, so ordering by id DESC with an
  // `id < cursor` keyset walks the list from newest to oldest.
  async listContentEntries(
    slug: string,
    params: { limit?: number; cursor?: string; contentType?: string; q?: string },
  ): Promise<{ items: DeliveredContentEntry[]; nextCursor: string | null; limit: number }> {
    const tenantId = await this.resolveTenantId();
    const site = await this.getSiteBySlug(tenantId, slug);
    const limit = clampLimit(params.limit);

    let contentTypeCondition: SQL | undefined;
    if (params.contentType !== undefined) {
      const contentTypeId = await this.findContentTypeIdByRef(tenantId, params.contentType);
      if (contentTypeId === null) {
        return { items: [], nextCursor: null, limit };
      }
      contentTypeCondition = eq(contentEntries.contentTypeId, contentTypeId);
    }

    // Naive substring search (spec 10): the title, or the whole values
    // payload rendered as text, which also matches field keys.
    const search = params.q?.trim();
    const searchPattern = search ? `%${escapeLikePattern(search)}%` : null;
    const searchCondition = searchPattern
      ? or(
          ilike(contentEntries.title, searchPattern),
          ilike(sql`${contentEntries.values}::text`, searchPattern),
        )
      : undefined;

    const rows = await this.db
      .select({
        id: contentEntries.id,
        externalReferenceCode: contentEntries.externalReferenceCode,
        title: contentEntries.title,
        contentType: contentTypes.externalReferenceCode,
        values: contentEntries.values,
        updatedAt: contentEntries.updatedAt,
      })
      .from(contentEntries)
      .innerJoin(
        contentTypes,
        and(eq(contentTypes.id, contentEntries.contentTypeId), eq(contentTypes.tenantId, tenantId)),
      )
      .where(
        and(
          eq(contentEntries.tenantId, tenantId),
          // Site-scoped only: tenant-wide entries (siteId null) belong to no
          // site and never surface in a site's public listing (spec 10).
          eq(contentEntries.siteId, site.id),
          eq(contentEntries.status, 'PUBLISHED'),
          contentTypeCondition,
          searchCondition,
          params.cursor ? lt(contentEntries.id, decodeCursor(params.cursor).id) : undefined,
        ),
      )
      .orderBy(desc(contentEntries.id))
      .limit(limit + 1);

    const window = rows.slice(0, limit);
    const last = window[window.length - 1];
    const nextCursor = rows.length > limit && last ? encodeCursor(last.id) : null;
    return { items: window, nextCursor, limit };
  }

  // CSS variables of the tenant's most recently published Style Book;
  // empty :root {} when none exists (spec 10).
  async renderStyleCss(slug: string): Promise<string> {
    const tenantId = await this.resolveTenantId();
    await this.getSiteBySlug(tenantId, slug);

    const latest = (
      await this.db
        .select({ tokens: styleBooks.tokens, tokensDark: styleBooks.tokensDark })
        .from(styleBooks)
        .where(and(eq(styleBooks.tenantId, tenantId), eq(styleBooks.status, 'PUBLISHED')))
        .orderBy(desc(styleBooks.updatedAt))
        .limit(1)
    )[0];
    return renderTokensCss(latest?.tokens ?? {}, latest?.tokensDark);
  }
}
