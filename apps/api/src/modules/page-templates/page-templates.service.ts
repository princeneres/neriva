import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, gt, inArray } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { isUniqueViolation } from '../../common/pg-errors';
import { expectedUpdatedAt, staleResource } from '../../common/optimistic-concurrency';
import { clampLimit, decodeCursor, encodeCursor } from '../../common/pagination';
import { DB, type Database } from '../../db/database';
import {
  blocks,
  pages,
  pageTemplates,
  type PageTemplateKind,
  type PageTree,
} from '../../db/schema';
import { TenantScopedRepository, type CursorPage } from '../../db/tenant-scoped.repository';
import {
  collectBlockRefs,
  countDropZoneNodes,
  DROP_ZONE_BLOCK,
  parsePageTree,
  validatePageTree,
  type BlockDefinition,
  type TreeValidationError,
} from '../pages/page-tree.validation';
import { SitesService } from '../sites/sites.service';

export type PageTemplateRow = InferSelectModel<typeof pageTemplates>;

const EMPTY_TREE: PageTree = { blocks: [] };
const DEFAULT_MASTER_TREE: PageTree = { blocks: [{ block: DROP_ZONE_BLOCK }] };
const DUPLICATE_DETAIL = 'A page template with this name or ERC already exists';

@Injectable()
export class PageTemplatesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly sitesService: SitesService,
  ) {}

  private repo(tenantId: string): TenantScopedRepository<typeof pageTemplates> {
    return new TenantScopedRepository(this.db, pageTemplates, tenantId);
  }

  async list(
    tenantId: string,
    params: { limit?: number; cursor?: string; kind?: PageTemplateKind },
  ): Promise<CursorPage<PageTemplateRow>> {
    if (params.kind === undefined) {
      return this.repo(tenantId).list(params);
    }
    // The generic repository has no extra-filter support; this mirrors its
    // pagination logic with the tenant filter applied explicitly (same
    // pattern as BlocksService.list with a status filter).
    const limit = clampLimit(params.limit);
    const conditions = [
      eq(pageTemplates.tenantId, tenantId),
      eq(pageTemplates.kind, params.kind),
      params.cursor ? gt(pageTemplates.id, decodeCursor(params.cursor).id) : undefined,
    ];
    const rows = await this.db
      .select()
      .from(pageTemplates)
      .where(and(...conditions))
      .orderBy(asc(pageTemplates.id))
      .limit(limit + 1);
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    const nextCursor = rows.length > limit && last ? encodeCursor(last.id) : null;
    return { items, nextCursor, limit };
  }

  async getByRef(tenantId: string, ref: string): Promise<PageTemplateRow> {
    const template = await this.repo(tenantId).findByRef(ref);
    if (!template) {
      throw new NotFoundException({ detail: `Page template ${ref} not found` });
    }
    return template;
  }

  async create(
    tenantId: string,
    createdBy: string,
    input: {
      name: string;
      kind: PageTemplateKind;
      site?: string;
      tree?: Record<string, unknown>;
      externalReferenceCode?: string;
    },
  ): Promise<PageTemplateRow> {
    const siteId =
      input.site !== undefined ? (await this.sitesService.getByRef(tenantId, input.site)).id : null;
    const tree =
      input.tree === undefined
        ? this.defaultTreeFor(input.kind)
        : await this.assertValidTree(tenantId, input.kind, input.tree);
    try {
      // Intermediate variable: tsc cannot apply the excess-property check to
      // the generic repository parameter and rejects fresh literals here.
      const values = {
        name: input.name,
        kind: input.kind,
        siteId,
        tree,
        createdBy,
        // undefined lets the envelope default generate one
        externalReferenceCode: input.externalReferenceCode,
      };
      return await this.repo(tenantId).create(values);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ detail: DUPLICATE_DETAIL });
      }
      throw error;
    }
  }

  async update(
    tenantId: string,
    ref: string,
    input: { name?: string; tree?: Record<string, unknown>; expectedUpdatedAt?: string },
  ): Promise<PageTemplateRow> {
    const existing = await this.getByRef(tenantId, ref);
    const values: Partial<{ name: string; tree: PageTree }> = {};
    if (input.name !== undefined) {
      values.name = input.name;
    }
    if (input.tree !== undefined) {
      values.tree = await this.assertValidTree(tenantId, existing.kind, input.tree);
    }
    if (Object.keys(values).length === 0) {
      return existing;
    }

    try {
      const expected = expectedUpdatedAt(input.expectedUpdatedAt);
      const updated = expected
        ? await this.repo(tenantId).updateByIdIfUnmodified(existing.id, expected, values)
        : await this.repo(tenantId).updateById(existing.id, values);
      if (expected && !updated) {
        throw staleResource('Page template');
      }
      return updated ?? existing;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ detail: DUPLICATE_DETAIL });
      }
      throw error;
    }
  }

  async delete(tenantId: string, ref: string): Promise<void> {
    const existing = await this.getByRef(tenantId, ref);
    // masterPageTemplateId is ON DELETE SET NULL at the FK level, but the
    // API contract (spec 14) blocks the delete with 409 while any page
    // still references this template, so the check runs before deleting.
    const referencing = await this.db
      .select({ id: pages.id })
      .from(pages)
      .where(and(eq(pages.tenantId, tenantId), eq(pages.masterPageTemplateId, existing.id)))
      .limit(1);
    if (referencing.length > 0) {
      throw new ConflictException({
        detail: `Page template "${existing.name}" is still set as the master page of at least one page`,
      });
    }
    await this.repo(tenantId).deleteById(existing.id);
  }

  // Marks a MASTER template as the tenant's default (spec 14), unsetting
  // whatever was previously marked so the "at most one default" invariant
  // (also enforced by the partial unique index on
  // page_templates_tenant_default_uq) holds even under a concurrent racing
  // call. Non-MASTER templates cannot be marked default: the flag is only
  // meaningful as a fallback for pages, and only a MASTER tree can wrap one.
  async setDefault(tenantId: string, ref: string): Promise<PageTemplateRow> {
    const existing = await this.getByRef(tenantId, ref);
    if (existing.kind !== 'MASTER') {
      throw new BadRequestException({
        detail: 'only a MASTER page template can be marked as the tenant default',
      });
    }
    if (existing.siteId !== null) {
      throw new BadRequestException({
        detail: 'A site-scoped MASTER page template cannot be the tenant default',
      });
    }
    if (existing.isDefault) {
      return existing;
    }
    return this.db.transaction(async (tx) => {
      await tx
        .update(pageTemplates)
        .set({ isDefault: false })
        .where(and(eq(pageTemplates.tenantId, tenantId), eq(pageTemplates.isDefault, true)));
      const [updated] = await tx
        .update(pageTemplates)
        .set({ isDefault: true })
        .where(and(eq(pageTemplates.tenantId, tenantId), eq(pageTemplates.id, existing.id)))
        .returning();
      if (!updated) {
        throw new NotFoundException({ detail: `Page template ${ref} not found` });
      }
      return updated;
    });
  }

  // Resolution order (spec 14): the page's own masterPageTemplateId -> the
  // tenant's isDefault MASTER template -> the single MASTER template with
  // the lowest createdAt (last-resort fallback so a tenant that has not
  // explicitly marked a default yet does not silently lose its wrapper) ->
  // no master. Exposed for delivery (and any other render path) to call.
  async findMasterForPage(
    tenantId: string,
    page: { masterPageTemplateId: string | null },
  ): Promise<PageTemplateRow | null> {
    if (page.masterPageTemplateId) {
      const own = await this.repo(tenantId).findById(page.masterPageTemplateId);
      if (own) {
        return own;
      }
      // Dangling id would mean a race with a delete; fall through to the
      // tenant default rather than surfacing an error on a read path.
    }

    const defaultRows = await this.db
      .select()
      .from(pageTemplates)
      .where(
        and(
          eq(pageTemplates.tenantId, tenantId),
          eq(pageTemplates.kind, 'MASTER'),
          eq(pageTemplates.isDefault, true),
        ),
      )
      .limit(1);
    if (defaultRows[0]) {
      return defaultRows[0];
    }

    return this.findOldestMaster(tenantId);
  }

  private async findOldestMaster(tenantId: string): Promise<PageTemplateRow | null> {
    const rows = await this.db
      .select()
      .from(pageTemplates)
      .where(and(eq(pageTemplates.tenantId, tenantId), eq(pageTemplates.kind, 'MASTER')))
      .orderBy(asc(pageTemplates.createdAt))
      .limit(1);
    return rows[0] ?? null;
  }

  private defaultTreeFor(kind: PageTemplateKind): PageTree {
    return kind === 'MASTER' ? DEFAULT_MASTER_TREE : EMPTY_TREE;
  }

  // Validates structure, block existence, slot names and props exactly like
  // a page tree (spec 03), plus the drop-zone rules for MASTER templates
  // (spec 14): STANDARD trees reuse the page path unmodified, so a drop
  // zone there falls into the ordinary unknown-block 400.
  private async assertValidTree(
    tenantId: string,
    kind: PageTemplateKind,
    rawTree: unknown,
  ): Promise<PageTree> {
    const parsed = parsePageTree(rawTree);
    if (parsed.error) {
      this.throwTreeError(parsed.error);
    }
    const tree = parsed.tree;

    const refs = collectBlockRefs(tree);
    const blocksByErc = new Map<string, BlockDefinition>();
    if (refs.length > 0) {
      const rows = await this.db
        .select({
          externalReferenceCode: blocks.externalReferenceCode,
          status: blocks.status,
          propsSchema: blocks.propsSchema,
          slots: blocks.slots,
        })
        .from(blocks)
        .where(and(eq(blocks.tenantId, tenantId), inArray(blocks.externalReferenceCode, refs)));
      for (const row of rows) {
        blocksByErc.set(row.externalReferenceCode, row);
      }
    }

    const error = validatePageTree(tree, blocksByErc, { allowDropZone: kind === 'MASTER' });
    if (error) {
      this.throwTreeError(error);
    }

    if (kind === 'MASTER' && countDropZoneNodes(tree) !== 1) {
      throw new BadRequestException({
        detail: 'a master page must contain exactly one page-content drop zone',
      });
    }

    return tree;
  }

  private throwTreeError(error: TreeValidationError): never {
    const location = error.pointer ? ` at ${error.pointer}` : '';
    throw new BadRequestException({
      detail: `Invalid page template tree${location}: ${error.message}`,
    });
  }
}
