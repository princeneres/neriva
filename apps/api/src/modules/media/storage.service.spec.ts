import { mkdtempSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StorageService } from './storage.service';

const KEY_PATTERN =
  /^([0-9a-f]{2})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\.[a-z0-9]{1,10})?$/;

describe('StorageService', () => {
  let root: string;
  let service: StorageService;
  let previousDir: string | undefined;

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'neriva-storage-'));
    previousDir = process.env.MEDIA_STORAGE_DIR;
    process.env.MEDIA_STORAGE_DIR = root;
    service = new StorageService();
  });

  afterAll(() => {
    if (previousDir === undefined) {
      delete process.env.MEDIA_STORAGE_DIR;
    } else {
      process.env.MEDIA_STORAGE_DIR = previousDir;
    }
    rmSync(root, { recursive: true, force: true });
  });

  describe('generateKey', () => {
    it('produces <2-char shard>/<uuid><ext>', () => {
      const key = service.generateKey('photo.PNG');
      const match = KEY_PATTERN.exec(key);
      expect(match).not.toBeNull();
      expect(match?.[3]).toBe('.png');
    });

    it('uses the first two characters of the uuid as the shard', () => {
      const key = service.generateKey('a.txt');
      const [shard, rest] = key.split('/');
      expect(rest?.startsWith(shard ?? '')).toBe(true);
    });

    it('omits the extension when there is none', () => {
      expect(KEY_PATTERN.exec(service.generateKey('README'))?.[3]).toBeUndefined();
    });

    it('drops unsafe or oversized extensions', () => {
      expect(KEY_PATTERN.exec(service.generateKey('weird.t x t'))?.[3]).toBeUndefined();
      expect(KEY_PATTERN.exec(service.generateKey(`f.${'a'.repeat(20)}`))?.[3]).toBeUndefined();
    });

    it('generates unique keys per call', () => {
      expect(service.generateKey('a.txt')).not.toBe(service.generateKey('a.txt'));
    });
  });

  describe('write / read / delete', () => {
    it('round-trips bytes through the shard directory', async () => {
      const key = service.generateKey('hello.txt');
      await service.write(key, Buffer.from('hello world'));
      expect((await readFile(join(root, key))).toString()).toBe('hello world');

      const stored = await service.read(key);
      expect(stored).not.toBeNull();
      expect(stored?.sizeBytes).toBe(11);
      const chunks: Buffer[] = [];
      for await (const chunk of stored?.stream ?? []) {
        chunks.push(chunk as Buffer);
      }
      expect(Buffer.concat(chunks).toString()).toBe('hello world');
    });

    it('returns null when reading a missing key', async () => {
      expect(await service.read('ff/missing')).toBeNull();
    });

    it('deletes bytes and tolerates a second delete', async () => {
      const key = service.generateKey('bye.txt');
      await service.write(key, Buffer.from('bye'));
      await service.delete(key);
      expect(await service.read(key)).toBeNull();
      await expect(service.delete(key)).resolves.toBeUndefined();
    });
  });
});
