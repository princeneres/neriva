import { describe, expect, it } from 'vitest';
import {
  isSensitiveSettingKey,
  toSystemSettingResponse,
  type SystemSettingRow,
} from './system-settings.service';

const row: SystemSettingRow = {
  id: '00000000-0000-7000-8000-000000000001',
  externalReferenceCode: 'setting-1',
  tenantId: '00000000-0000-7000-8000-000000000002',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  createdBy: null,
  key: 'smtp.password',
  value: 'do-not-return-this',
};

describe('system setting response protection', () => {
  it('recognizes credential-like setting keys', () => {
    expect(isSensitiveSettingKey('smtp.password')).toBe(true);
    expect(isSensitiveSettingKey('integration.api-key')).toBe(true);
    expect(isSensitiveSettingKey('site.name')).toBe(false);
  });

  it('redacts sensitive values while preserving ordinary values', () => {
    expect(toSystemSettingResponse(row)).toMatchObject({ value: null, isSensitive: true });
    expect(toSystemSettingResponse({ ...row, key: 'site.name', value: 'Neriva' })).toMatchObject({
      value: 'Neriva',
      isSensitive: false,
    });
  });
});
