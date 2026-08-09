import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import type { Readable } from 'node:stream';

// Only simple, lowercase extensions survive into the storage key; anything
// exotic is dropped (the display name keeps the original).
const SAFE_EXTENSION = /^\.[a-z0-9]{1,10}$/;

export interface StoredFile {
  stream: Readable;
  sizeBytes: number;
}

// Local-filesystem blob store (spec 11). Kept behind this small injectable
// class so an S3-backed implementation can replace it without touching the
// media service or controllers.
@Injectable()
export class StorageService {
  private readonly root = resolve(process.env.MEDIA_STORAGE_DIR ?? './uploads');

  // <2-char shard>/<uuid><ext>. A random UUID (v4) keeps the shard prefix
  // uniformly distributed, which time-ordered UUIDv7 would not.
  generateKey(fileName: string): string {
    const id = randomUUID();
    const ext = extname(fileName).toLowerCase();
    return `${id.slice(0, 2)}/${id}${SAFE_EXTENSION.test(ext) ? ext : ''}`;
  }

  async write(storageKey: string, bytes: Buffer): Promise<void> {
    const path = join(this.root, storageKey);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  async read(storageKey: string): Promise<StoredFile | null> {
    const path = join(this.root, storageKey);
    try {
      const stats = await stat(path);
      return { stream: createReadStream(path), sizeBytes: stats.size };
    } catch {
      return null;
    }
  }

  // Best-effort: a missing physical file must never fail the metadata delete.
  async delete(storageKey: string): Promise<void> {
    try {
      await unlink(join(this.root, storageKey));
    } catch {
      // ignored
    }
  }
}
