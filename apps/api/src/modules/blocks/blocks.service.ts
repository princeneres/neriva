import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, gt } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { isUniqueViolation } from '../../common/pg-errors';
import { clampLimit, decodeCursor, encodeCursor } from '../../common/pagination';
import { normalizeSearchTerm, trigramSearch } from '../../common/search';
import { DB, type Database } from '../../db/database';
import { blocks, type BlockSlot, type BlockTemplateSource } from '../../db/schema';
import { TenantScopedRepository, type CursorPage } from '../../db/tenant-scoped.repository';
import { validatePropsSchema, validateSlots } from './block-validation';
import {
  validateBlockCss,
  validateBlockJavaScript,
  validateBlockTemplate,
} from './template-validation';
import type { BlockStatus } from './dto/blocks.dto';
import { ResourceFoldersService } from '../resource-folders/resource-folders.service';

export type BlockRow = InferSelectModel<typeof blocks>;

@Injectable()
export class BlocksService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly foldersService: ResourceFoldersService,
  ) {}

  private repo(tenantId: string): TenantScopedRepository<typeof blocks> {
    return new TenantScopedRepository(this.db, blocks, tenantId);
  }

  // Search is trigram based over name, category and description
  // (blocks_search_idx): short labels an editor half remembers, so substring
  // plus typo tolerance is worth more than stemming here.
  async list(
    tenantId: string,
    params: {
      limit?: number;
      cursor?: string;
      status?: BlockStatus;
      folder?: string;
      search?: string;
    },
  ): Promise<CursorPage<BlockRow>> {
    const search = normalizeSearchTerm(params.search);
    if (params.status === undefined && params.folder === undefined && search === undefined) {
      return this.repo(tenantId).list(params);
    }
    // The generic repository has no extra-filter support; this mirrors its
    // pagination logic with the tenant filter applied explicitly.
    const limit = clampLimit(params.limit);
    const conditions = [
      eq(blocks.tenantId, tenantId),
      params.status ? eq(blocks.status, params.status) : undefined,
      params.folder
        ? eq(
            blocks.folderId,
            (await this.foldersService.assertForResource(tenantId, params.folder, 'blocks')).id,
          )
        : undefined,
      search
        ? trigramSearch(search, [blocks.name, blocks.category, blocks.description])
        : undefined,
      params.cursor ? gt(blocks.id, decodeCursor(params.cursor).id) : undefined,
    ];
    const rows = await this.db
      .select()
      .from(blocks)
      .where(and(...conditions))
      .orderBy(asc(blocks.id))
      .limit(limit + 1);
    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    const nextCursor = rows.length > limit && last ? encodeCursor(last.id) : null;
    return { items, nextCursor, limit };
  }

  async getByRef(tenantId: string, ref: string): Promise<BlockRow> {
    const block = await this.repo(tenantId).findByRef(ref);
    if (!block) {
      throw new NotFoundException({ detail: `Block ${ref} not found` });
    }
    return block;
  }

  async create(
    tenantId: string,
    createdBy: string,
    input: {
      name: string;
      category?: string;
      description?: string;
      propsSchema: Record<string, unknown>;
      slots?: BlockSlot[];
      html?: string | null;
      css?: string | null;
      js?: string | null;
      externalReferenceCode?: string;
      folderId?: string | null;
    },
  ): Promise<BlockRow> {
    const folder = input.folderId
      ? await this.foldersService.assertForResource(tenantId, input.folderId, 'blocks')
      : null;
    this.assertValidDefinition(
      input.propsSchema,
      input.slots ?? [],
      input.html ?? null,
      input.css ?? null,
      input.js ?? null,
    );
    try {
      // Intermediate variable: tsc cannot apply the excess-property check to
      // the generic repository parameter and rejects fresh literals here.
      const values = {
        name: input.name,
        category: input.category ?? null,
        description: input.description ?? null,
        propsSchema: input.propsSchema,
        slots: input.slots ?? [],
        html: input.html ?? null,
        css: input.css ?? null,
        js: input.js ?? null,
        templateSource: 'CUSTOM' as BlockTemplateSource,
        folderId: folder?.id ?? null,
        createdBy,
        // undefined lets the envelope default generate one
        externalReferenceCode: input.externalReferenceCode,
      };
      return await this.repo(tenantId).create(values);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ detail: 'A block with this ERC already exists' });
      }
      throw error;
    }
  }

  async update(
    tenantId: string,
    ref: string,
    input: {
      name?: string;
      category?: string;
      description?: string;
      propsSchema?: Record<string, unknown>;
      slots?: BlockSlot[];
      html?: string | null;
      css?: string | null;
      js?: string | null;
      folderId?: string | null;
    },
  ): Promise<BlockRow> {
    const existing = await this.getByRef(tenantId, ref);
    const folder = input.folderId
      ? await this.foldersService.assertForResource(tenantId, input.folderId, 'blocks')
      : null;
    // Effective values: a PATCH that changes only propsSchema or slots must
    // keep the stored template consistent with them, so the template is
    // re-validated against the merged definition.
    this.assertValidDefinition(
      input.propsSchema ?? existing.propsSchema,
      input.slots ?? existing.slots,
      input.html !== undefined ? input.html : existing.html,
      input.css !== undefined ? input.css : existing.css,
      input.js !== undefined ? input.js : existing.js,
    );

    const values: Partial<{
      name: string;
      category: string | null;
      description: string | null;
      propsSchema: Record<string, unknown>;
      slots: BlockSlot[];
      html: string | null;
      css: string | null;
      js: string | null;
      templateSource: BlockTemplateSource;
      folderId: string | null;
    }> = {};
    if (input.name !== undefined) {
      values.name = input.name;
    }
    if (input.category !== undefined) {
      values.category = input.category;
    }
    if (input.description !== undefined) {
      values.description = input.description;
    }
    if (input.propsSchema !== undefined) {
      values.propsSchema = input.propsSchema;
    }
    if (input.slots !== undefined) {
      values.slots = input.slots;
    }
    if (input.html !== undefined) {
      values.html = input.html;
    }
    if (input.css !== undefined) {
      values.css = input.css;
    }
    if (input.js !== undefined) {
      values.js = input.js;
    }
    if (input.html !== undefined || input.css !== undefined || input.js !== undefined) {
      const activeHtml = input.html !== undefined ? input.html : existing.html;
      const activeCss = input.css !== undefined ? input.css : existing.css;
      const activeJs = input.js !== undefined ? input.js : existing.js;
      values.templateSource = this.templateSourceFor(existing, activeHtml, activeCss, activeJs);
    }
    if (input.folderId !== undefined) {
      values.folderId = folder?.id ?? null;
    }

    if (Object.keys(values).length === 0) {
      return existing;
    }
    const updated = await this.repo(tenantId).updateById(existing.id, values);
    return updated ?? existing;
  }

  async delete(tenantId: string, ref: string): Promise<void> {
    const existing = await this.getByRef(tenantId, ref);
    await this.repo(tenantId).deleteById(existing.id);
  }

  async publish(tenantId: string, ref: string): Promise<BlockRow> {
    const existing = await this.getByRef(tenantId, ref);
    // Direct scoped update: the generic repository cannot type a
    // status-only patch (optional insert keys are lost through the generic).
    const rows = await this.db
      .update(blocks)
      .set({ status: 'PUBLISHED', updatedAt: new Date() })
      .where(and(eq(blocks.tenantId, tenantId), eq(blocks.id, existing.id)))
      .returning();
    return rows[0] ?? existing;
  }

  async restoreNativeTemplate(tenantId: string, ref: string): Promise<BlockRow> {
    const existing = await this.getByRef(tenantId, ref);
    if (existing.nativeHtml === null || existing.nativeCss === null) {
      throw new BadRequestException({
        detail: 'This block does not have a native template to restore',
      });
    }
    const rows = await this.db
      .update(blocks)
      .set({
        html: existing.nativeHtml,
        css: existing.nativeCss,
        js: existing.nativeJs,
        templateSource: 'NATIVE',
        updatedAt: new Date(),
      })
      .where(and(eq(blocks.tenantId, tenantId), eq(blocks.id, existing.id)))
      .returning();
    return rows[0] ?? existing;
  }

  private templateSourceFor(
    existing: BlockRow,
    html: string | null,
    css: string | null,
    js: string | null,
  ): BlockTemplateSource {
    if (existing.nativeHtml !== null && existing.nativeCss !== null) {
      return existing.nativeHtml === html && existing.nativeCss === css && existing.nativeJs === js
        ? 'NATIVE'
        : 'CUSTOM';
    }
    return 'CUSTOM';
  }

  private assertValidDefinition(
    propsSchema: unknown,
    slots: BlockSlot[],
    html: string | null,
    css: string | null,
    js: string | null,
  ): void {
    const schemaError = validatePropsSchema(propsSchema);
    if (schemaError) {
      throw new BadRequestException({ detail: schemaError });
    }
    const slotsError = validateSlots(slots);
    if (slotsError) {
      throw new BadRequestException({ detail: slotsError });
    }
    if (html !== null) {
      // Safe cast: validatePropsSchema above proved it is an object.
      const templateError = validateBlockTemplate(
        html,
        slots,
        propsSchema as Record<string, unknown>,
      );
      if (templateError) {
        throw new BadRequestException({ detail: templateError });
      }
    }
    if (css !== null) {
      const cssError = validateBlockCss(css);
      if (cssError) {
        throw new BadRequestException({ detail: cssError });
      }
    }
    if (js !== null) {
      if (html !== null && /data-nv-slot\s*=/i.test(html)) {
        throw new BadRequestException({
          detail:
            'A JavaScript-enabled Block cannot use data-nv-slot yet because its source runs in an isolated document',
        });
      }
      const javascriptError = validateBlockJavaScript(js);
      if (javascriptError) {
        throw new BadRequestException({ detail: javascriptError });
      }
    }
  }
}
