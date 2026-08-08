import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { isUniqueViolation } from '../../common/pg-errors';
import { DB, type Database } from '../../db/database';
import { styleBooks } from '../../db/schema';
import { TenantScopedRepository, type CursorPage } from '../../db/tenant-scoped.repository';
import { findTokenViolations, renderCss } from './tokens';

export type StyleBookRow = InferSelectModel<typeof styleBooks>;

@Injectable()
export class StylebookService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private repo(tenantId: string): TenantScopedRepository<typeof styleBooks> {
    return new TenantScopedRepository(this.db, styleBooks, tenantId);
  }

  async list(
    tenantId: string,
    params: { limit?: number; cursor?: string },
  ): Promise<CursorPage<StyleBookRow>> {
    return this.repo(tenantId).list(params);
  }

  async getByRef(tenantId: string, ref: string): Promise<StyleBookRow> {
    const styleBook = await this.repo(tenantId).findByRef(ref);
    if (!styleBook) {
      throw new NotFoundException({ detail: `Style Book ${ref} not found` });
    }
    return styleBook;
  }

  async create(
    tenantId: string,
    createdBy: string,
    input: { name: string; tokens: Record<string, string>; externalReferenceCode?: string },
  ): Promise<StyleBookRow> {
    this.assertValidTokens(input.tokens);
    try {
      // Intermediate variable: tsc cannot apply the excess-property check to
      // the generic repository parameter and rejects fresh literals here.
      const values = {
        name: input.name,
        tokens: input.tokens,
        createdBy,
        // undefined lets the envelope default generate one
        externalReferenceCode: input.externalReferenceCode,
      };
      return await this.repo(tenantId).create(values);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({
          detail: 'A style book with this name or ERC already exists',
        });
      }
      throw error;
    }
  }

  async update(
    tenantId: string,
    ref: string,
    input: { name?: string; tokens?: Record<string, string> },
  ): Promise<StyleBookRow> {
    const existing = await this.getByRef(tenantId, ref);
    const values: Partial<{ name: string; tokens: Record<string, string> }> = {};
    if (input.name !== undefined) {
      values.name = input.name;
    }
    if (input.tokens !== undefined) {
      this.assertValidTokens(input.tokens);
      values.tokens = input.tokens;
    }
    if (Object.keys(values).length === 0) {
      return existing;
    }

    try {
      const updated = await this.repo(tenantId).updateById(existing.id, values);
      return updated ?? existing;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ detail: 'A style book with this name already exists' });
      }
      throw error;
    }
  }

  async delete(tenantId: string, ref: string): Promise<void> {
    const existing = await this.getByRef(tenantId, ref);
    await this.repo(tenantId).deleteById(existing.id);
  }

  async publish(tenantId: string, ref: string): Promise<StyleBookRow> {
    const existing = await this.getByRef(tenantId, ref);
    // Explicitly typed variable: tsc cannot run the weak-type overlap check
    // against the repository's generic update parameter and rejects fresh
    // literals here.
    const values: Partial<Omit<InferInsertModel<typeof styleBooks>, 'id' | 'tenantId'>> = {
      status: 'PUBLISHED',
      version: existing.version + 1,
    };
    const updated = await this.repo(tenantId).updateById(existing.id, values);
    return updated ?? existing;
  }

  async renderCssByRef(tenantId: string, ref: string): Promise<string> {
    const styleBook = await this.getByRef(tenantId, ref);
    return renderCss(styleBook.tokens);
  }

  private assertValidTokens(tokens: Record<string, string>): void {
    const violations = findTokenViolations(tokens);
    if (violations) {
      const parts: string[] = [];
      if (violations.invalidNames.length > 0) {
        parts.push(`invalid token names: ${violations.invalidNames.join(', ')}`);
      }
      if (violations.invalidValues.length > 0) {
        parts.push(`invalid token values for: ${violations.invalidValues.join(', ')}`);
      }
      throw new BadRequestException({ detail: `Invalid tokens; ${parts.join('; ')}` });
    }
  }
}
