import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, type InferSelectModel } from 'drizzle-orm';
import { isUniqueViolation } from '../../common/pg-errors';
import { DB, type Database } from '../../db/database';
import { systemSettings } from '../../db/schema';
import { TenantScopedRepository, type CursorPage } from '../../db/tenant-scoped.repository';

export type SystemSettingRow = InferSelectModel<typeof systemSettings>;
export type SystemSettingResponse = Omit<SystemSettingRow, 'value'> & {
  value: unknown | null;
  isSensitive: boolean;
};

const SENSITIVE_SETTING_KEY_PATTERN = /(?:password|secret|token|api-key|private-key)$/i;

export function isSensitiveSettingKey(key: string): boolean {
  return SENSITIVE_SETTING_KEY_PATTERN.test(key);
}

export function toSystemSettingResponse(row: SystemSettingRow): SystemSettingResponse {
  const isSensitive = isSensitiveSettingKey(row.key);
  return {
    ...row,
    value: isSensitive ? null : row.value,
    isSensitive,
  };
}

// Spec 07: keys are lowercase, dot/dash separated, start with a letter.
const SETTING_KEY_PATTERN = /^[a-z][a-z0-9.-]*$/;
const SETTING_KEY_MAX_LENGTH = 100;

@Injectable()
export class SystemSettingsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  private repo(tenantId: string): TenantScopedRepository<typeof systemSettings> {
    return new TenantScopedRepository(this.db, systemSettings, tenantId);
  }

  private assertValidKey(key: string): void {
    if (key.length > SETTING_KEY_MAX_LENGTH || !SETTING_KEY_PATTERN.test(key)) {
      throw new BadRequestException({
        detail: `Invalid setting key "${key}": must match ${SETTING_KEY_PATTERN.source} and be at most ${SETTING_KEY_MAX_LENGTH} characters`,
      });
    }
  }

  // The repository has no lookup by arbitrary column; this is the one direct
  // query, and it is tenant-scoped explicitly.
  private async findByKey(tenantId: string, key: string): Promise<SystemSettingRow | null> {
    const rows = await this.db
      .select()
      .from(systemSettings)
      .where(and(eq(systemSettings.tenantId, tenantId), eq(systemSettings.key, key)))
      .limit(1);
    return rows[0] ?? null;
  }

  async list(
    tenantId: string,
    params: { limit?: number; cursor?: string },
  ): Promise<CursorPage<SystemSettingRow>> {
    return this.repo(tenantId).list(params);
  }

  async getByKey(tenantId: string, key: string): Promise<SystemSettingRow> {
    this.assertValidKey(key);
    const setting = await this.findByKey(tenantId, key);
    if (!setting) {
      throw new NotFoundException({ detail: `System setting ${key} not found` });
    }
    return setting;
  }

  async upsert(
    tenantId: string,
    createdBy: string,
    key: string,
    value: unknown,
  ): Promise<{ setting: SystemSettingRow; created: boolean }> {
    this.assertValidKey(key);
    const existing = await this.findByKey(tenantId, key);
    if (existing) {
      return { setting: await this.updateValue(tenantId, existing.id, value), created: false };
    }
    try {
      // Intermediate variable: tsc cannot apply the excess-property check to
      // the generic repository parameter and rejects fresh literals here.
      const values = { key, value, createdBy };
      const setting = await this.repo(tenantId).create(values);
      return { setting, created: true };
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Lost a create race; the row exists now, so update it instead.
        const row = await this.findByKey(tenantId, key);
        if (row) {
          return { setting: await this.updateValue(tenantId, row.id, value), created: false };
        }
      }
      throw error;
    }
  }

  async deleteByKey(tenantId: string, key: string): Promise<void> {
    const existing = await this.getByKey(tenantId, key);
    await this.repo(tenantId).deleteById(existing.id);
  }

  private async updateValue(
    tenantId: string,
    id: string,
    value: unknown,
  ): Promise<SystemSettingRow> {
    const updated = await this.repo(tenantId).updateById(id, { value });
    if (!updated) {
      throw new NotFoundException({ detail: 'System setting not found' });
    }
    return updated;
  }
}
