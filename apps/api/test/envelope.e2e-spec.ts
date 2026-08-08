import * as argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SeedService } from '../src/db/seed.service';
import { roles, tenants, users } from '../src/db/schema';
import { TenantScopedRepository } from '../src/db/tenant-scoped.repository';
import { startTestDb, type TestDb } from './utils/test-db';

describe('entity envelope base (e2e)', () => {
  let testDb: TestDb;
  let tenantA: string;
  let tenantB: string;

  beforeAll(async () => {
    testDb = await startTestDb();
    const created = await testDb.db
      .insert(tenants)
      .values([
        { externalReferenceCode: 'tenant-a', name: 'Tenant A' },
        { externalReferenceCode: 'tenant-b', name: 'Tenant B' },
      ])
      .returning();
    tenantA = created.find((t) => t.externalReferenceCode === 'tenant-a')!.id;
    tenantB = created.find((t) => t.externalReferenceCode === 'tenant-b')!.id;
  });

  afterAll(async () => {
    await testDb.stop();
  });

  describe('TenantScopedRepository', () => {
    it('fills the envelope defaults on create', async () => {
      const repo = new TenantScopedRepository(testDb.db, roles, tenantA);
      const role = await repo.create({ name: 'Editor' });

      expect(role.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(role.externalReferenceCode).toBeTruthy();
      expect(role.tenantId).toBe(tenantA);
      expect(role.createdAt).toBeInstanceOf(Date);
      expect(role.updatedAt).toBeInstanceOf(Date);
      expect(role.createdBy).toBeNull();
    });

    it('scopes reads to the tenant by construction', async () => {
      const repoA = new TenantScopedRepository(testDb.db, roles, tenantA);
      const repoB = new TenantScopedRepository(testDb.db, roles, tenantB);
      const role = await repoA.create({ name: 'Reviewer' });

      expect(await repoA.findById(role.id)).not.toBeNull();
      expect(await repoB.findById(role.id)).toBeNull();
      expect(await repoB.findByErc(role.externalReferenceCode)).toBeNull();
      expect((await repoB.list()).items).toHaveLength(0);
    });

    it('upserts by externalReferenceCode', async () => {
      const repo = new TenantScopedRepository(testDb.db, roles, tenantA);
      const first = await repo.upsertByErc('role-upsert', { name: 'Upsert v1' });
      const second = await repo.upsertByErc('role-upsert', { name: 'Upsert v2' });

      expect(second.id).toBe(first.id);
      expect(second.name).toBe('Upsert v2');
      expect(second.updatedAt.getTime()).toBeGreaterThanOrEqual(first.updatedAt.getTime());
    });

    it('keeps the same externalReferenceCode unique across tenants', async () => {
      const repoB = new TenantScopedRepository(testDb.db, roles, tenantB);
      const roleB = await repoB.upsertByErc('role-upsert', { name: 'Tenant B copy' });

      const repoA = new TenantScopedRepository(testDb.db, roles, tenantA);
      const roleA = await repoA.findByErc('role-upsert');
      expect(roleA).not.toBeNull();
      expect(roleA!.id).not.toBe(roleB.id);
    });

    it('paginates with cursors, default 20, max 100', async () => {
      const repo = new TenantScopedRepository(testDb.db, roles, tenantB);
      for (let i = 0; i < 5; i += 1) {
        await repo.create({ name: `Paged ${i}` });
      }

      const page1 = await repo.list({ limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.nextCursor).not.toBeNull();

      const page2 = await repo.list({ limit: 2, cursor: page1.nextCursor! });
      expect(page2.items).toHaveLength(2);
      expect(page2.items.map((r) => r.id)).not.toEqual(page1.items.map((r) => r.id));

      const all = await repo.list({ limit: 100 });
      expect(all.nextCursor).toBeNull();
      const walked = [...page1.items, ...page2.items].map((r) => r.id);
      expect(all.items.map((r) => r.id).slice(0, 4)).toEqual(walked);
    });
  });

  describe('first-boot seed', () => {
    it('seeds tenant, role and admin user, idempotently', async () => {
      const seed = new SeedService(testDb.db);
      await seed.run();
      await seed.run();

      const tenant = (
        await testDb.db.select().from(tenants).where(eq(tenants.externalReferenceCode, 'default'))
      )[0];
      expect(tenant).toBeDefined();
      expect(tenant!.name).toBe('Default');

      const admins = await testDb.db
        .select()
        .from(users)
        .where(eq(users.email, 'admin@neriva.com'));
      expect(admins).toHaveLength(1);
      expect(admins[0]!.mustChangePassword).toBe(true);
      expect(await argon2.verify(admins[0]!.passwordHash, 'admin')).toBe(true);
    });

    it('never resets an existing admin password', async () => {
      const changedHash = await argon2.hash('changed-by-user');
      await testDb.db
        .update(users)
        .set({ passwordHash: changedHash, mustChangePassword: false })
        .where(eq(users.email, 'admin@neriva.com'));

      const seed = new SeedService(testDb.db);
      await seed.run();

      const admin = (
        await testDb.db.select().from(users).where(eq(users.email, 'admin@neriva.com'))
      )[0];
      expect(admin!.passwordHash).toBe(changedHash);
      expect(admin!.mustChangePassword).toBe(false);
    });
  });
});
