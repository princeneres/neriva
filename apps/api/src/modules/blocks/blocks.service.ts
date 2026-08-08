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
import { DB, type Database } from '../../db/database';
import { blocks, type BlockSlot } from '../../db/schema';
import { TenantScopedRepository, type CursorPage } from '../../db/tenant-scoped.repository';
import { validatePropsSchema, validateSlots } from './block-validation';
import type { BlockStatus } from './dto/blocks.dto';

export type BlockRow = InferSelectModel<typeof blocks>;

@Injectable()
export class BlocksService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private repo(tenantId: string): TenantScopedRepository<typeof blocks> {
    return new TenantScopedRepository(this.db, blocks, tenantId);
  }

  async list(
    tenantId: string,
    params: { limit?: number; cursor?: string; status?: BlockStatus },
  ): Promise<CursorPage<BlockRow>> {
    if (params.status === undefined) {
      return this.repo(tenantId).list(params);
    }
    // The generic repository has no extra-filter support; this mirrors its
    // pagination logic with the tenant filter applied explicitly.
    const limit = clampLimit(params.limit);
    const conditions = [
      eq(blocks.tenantId, tenantId),
      eq(blocks.status, params.status),
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
      externalReferenceCode?: string;
    },
  ): Promise<BlockRow> {
    this.assertValidDefinition(input.propsSchema, input.slots ?? []);
    try {
      // Intermediate variable: tsc cannot apply the excess-property check to
      // the generic repository parameter and rejects fresh literals here.
      const values = {
        name: input.name,
        category: input.category ?? null,
        description: input.description ?? null,
        propsSchema: input.propsSchema,
        slots: input.slots ?? [],
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
    },
  ): Promise<BlockRow> {
    const existing = await this.getByRef(tenantId, ref);
    this.assertValidDefinition(
      input.propsSchema ?? existing.propsSchema,
      input.slots ?? existing.slots,
    );

    const values: Partial<{
      name: string;
      category: string | null;
      description: string | null;
      propsSchema: Record<string, unknown>;
      slots: BlockSlot[];
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

  private assertValidDefinition(propsSchema: unknown, slots: BlockSlot[]): void {
    const schemaError = validatePropsSchema(propsSchema);
    if (schemaError) {
      throw new BadRequestException({ detail: schemaError });
    }
    const slotsError = validateSlots(slots);
    if (slotsError) {
      throw new BadRequestException({ detail: slotsError });
    }
  }
}
