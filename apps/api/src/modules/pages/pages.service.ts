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
import { normalizeSearchTerm, trigramSearch } from '../../common/search';
import { DB, type Database } from '../../db/database';
import { blocks, pages, type PageTree } from '../../db/schema';
import { TenantScopedRepository, type CursorPage } from '../../db/tenant-scoped.repository';
import {
  PageTemplatesService,
  type PageTemplateRow,
} from '../page-templates/page-templates.service';
import { SitesService } from '../sites/sites.service';
import {
  collectBlockRefs,
  parsePageTree,
  validatePageTree,
  type BlockDefinition,
  type TreeValidationError,
} from './page-tree.validation';

export type PageRow = InferSelectModel<typeof pages>;

const EMPTY_TREE: PageTree = { blocks: [] };
const DUPLICATE_DETAIL = 'A page with this path or ERC already exists';

@Injectable()
export class PagesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly sitesService: SitesService,
    private readonly pageTemplatesService: PageTemplatesService,
  ) {}

  private repo(tenantId: string): TenantScopedRepository<typeof pages> {
    return new TenantScopedRepository(this.db, pages, tenantId);
  }

  // Search is trigram based over title and path (pages_search_idx): a page
  // library grows with the site, and an editor looking for one types a
  // fragment of its title, often with a typo or without accents.
  async listBySite(
    tenantId: string,
    siteRef: string,
    params: { limit?: number; cursor?: string; search?: string },
  ): Promise<CursorPage<PageRow>> {
    const site = await this.sitesService.getByRef(tenantId, siteRef);
    const search = normalizeSearchTerm(params.search);
    // The generic repository has no extra-filter support; this mirrors its
    // pagination logic with the tenant filter applied explicitly.
    const limit = clampLimit(params.limit);
    const conditions = [
      eq(pages.tenantId, tenantId),
      eq(pages.siteId, site.id),
      search ? trigramSearch(search, [pages.title, pages.path]) : undefined,
      params.cursor ? gt(pages.id, decodeCursor(params.cursor).id) : undefined,
    ];
    const rows = await this.db
      .select()
      .from(pages)
      .where(and(...conditions))
      .orderBy(asc(pages.id))
      .limit(limit + 1);
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    const nextCursor = rows.length > limit && last ? encodeCursor(last.id) : null;
    return { items, nextCursor, limit };
  }

  async getByRef(tenantId: string, ref: string): Promise<PageRow> {
    const page = await this.repo(tenantId).findByRef(ref);
    if (!page) {
      throw new NotFoundException({ detail: `Page ${ref} not found` });
    }
    return page;
  }

  async create(
    tenantId: string,
    createdBy: string,
    siteRef: string,
    input: {
      title: string;
      path: string;
      tree?: Record<string, unknown>;
      templateId?: string;
      masterPageTemplateId?: string;
      externalReferenceCode?: string;
    },
  ): Promise<PageRow> {
    const site = await this.sitesService.getByRef(tenantId, siteRef);
    const initialTree = await this.resolveInitialTree(tenantId, input);
    const tree =
      initialTree === undefined ? EMPTY_TREE : await this.assertValidTree(tenantId, initialTree);
    const masterPageTemplateId =
      input.masterPageTemplateId !== undefined
        ? (await this.resolveMasterRef(tenantId, site.id, input.masterPageTemplateId)).id
        : null;
    try {
      // Intermediate variable: tsc cannot apply the excess-property check to
      // the generic repository parameter and rejects fresh literals here.
      const values = {
        siteId: site.id,
        title: input.title,
        path: input.path,
        tree,
        masterPageTemplateId,
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
    input: {
      title?: string;
      path?: string;
      tree?: Record<string, unknown>;
      masterPageTemplateId?: string | null;
      expectedUpdatedAt?: string;
    },
  ): Promise<PageRow> {
    const existing = await this.getByRef(tenantId, ref);
    const values: Partial<{
      title: string;
      path: string;
      tree: PageTree;
      masterPageTemplateId: string | null;
    }> = {};
    if (input.title !== undefined) {
      values.title = input.title;
    }
    if (input.path !== undefined) {
      values.path = input.path;
    }
    if (input.tree !== undefined) {
      values.tree = await this.assertValidTree(tenantId, input.tree);
    }
    if (input.masterPageTemplateId !== undefined) {
      values.masterPageTemplateId =
        input.masterPageTemplateId === null
          ? null
          : (await this.resolveMasterRef(tenantId, existing.siteId, input.masterPageTemplateId)).id;
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
        throw staleResource('Page');
      }
      return updated ?? existing;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ detail: DUPLICATE_DETAIL });
      }
      throw error;
    }
  }

  // Create-only: a STANDARD template ref whose tree is copied once as the
  // initial tree, not persisted as an ongoing relationship (spec 14). An
  // explicit tree wins over templateId when both are given.
  private async resolveInitialTree(
    tenantId: string,
    input: { tree?: Record<string, unknown>; templateId?: string },
  ): Promise<unknown> {
    if (input.tree !== undefined) {
      return input.tree;
    }
    if (input.templateId === undefined) {
      return undefined;
    }
    const template = await this.pageTemplatesService.getByRef(tenantId, input.templateId);
    if (template.kind !== 'STANDARD') {
      throw new BadRequestException({
        detail: `Page template ${input.templateId} is not a STANDARD template`,
      });
    }
    return template.tree;
  }

  // A referenced master must be MASTER-kind and either siteless or scoped
  // to the page's own site (spec 14).
  private async resolveMasterRef(
    tenantId: string,
    siteId: string,
    ref: string,
  ): Promise<PageTemplateRow> {
    const template = await this.pageTemplatesService.getByRef(tenantId, ref);
    if (template.kind !== 'MASTER') {
      throw new BadRequestException({ detail: `Page template ${ref} is not a MASTER template` });
    }
    if (template.siteId !== null && template.siteId !== siteId) {
      throw new BadRequestException({
        detail: `Page template ${ref} is scoped to a different site`,
      });
    }
    return template;
  }

  async delete(tenantId: string, ref: string): Promise<void> {
    const existing = await this.getByRef(tenantId, ref);
    await this.repo(tenantId).deleteById(existing.id);
  }

  async publish(tenantId: string, ref: string): Promise<PageRow> {
    const existing = await this.getByRef(tenantId, ref);
    // Re-validate the stored tree; publishing additionally requires every
    // referenced block to be PUBLISHED (spec 03-pages).
    await this.assertValidTree(tenantId, existing.tree, { requirePublished: true });
    // Direct scoped update: the generic repository cannot type a
    // status-only patch (optional insert keys are lost through the generic).
    const rows = await this.db
      .update(pages)
      .set({ status: 'PUBLISHED', updatedAt: new Date() })
      .where(and(eq(pages.tenantId, tenantId), eq(pages.id, existing.id)))
      .returning();
    return rows[0] ?? existing;
  }

  // Validates structure, block existence, slot names and props; returns the
  // narrowed tree or throws 400 problem+json with a node pointer in detail.
  private async assertValidTree(
    tenantId: string,
    rawTree: unknown,
    options: { requirePublished?: boolean } = {},
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

    const error = validatePageTree(tree, blocksByErc, options);
    if (error) {
      this.throwTreeError(error);
    }
    return tree;
  }

  private throwTreeError(error: TreeValidationError): never {
    const location = error.pointer ? ` at ${error.pointer}` : '';
    throw new BadRequestException({ detail: `Invalid page tree${location}: ${error.message}` });
  }
}
