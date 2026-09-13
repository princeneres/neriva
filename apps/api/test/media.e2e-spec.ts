import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './utils/test-app';
import { startTestDb, type TestDb } from './utils/test-db';

interface Tokens {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
}

interface FolderData {
  id: string;
  externalReferenceCode: string;
  name: string;
  parentId: string | null;
  siteId: string | null;
}

interface FileData {
  id: string;
  externalReferenceCode: string;
  folderId: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  alt: string | null;
  url: string;
  customFields: Record<string, unknown>;
}

// Small limit override (spec 11 tests) so the 413 path does not need a 25 MB
// payload; every regular fixture stays far below it.
const MAX_UPLOAD_BYTES = 64 * 1024;

const BOUNDARY = 'neriva-e2e-boundary';

type MultipartPart =
  | { name: string; value: string }
  | { name: string; filename: string; contentType: string; data: Buffer };

// app.inject sends the raw body, so the multipart payload is assembled by
// hand; no test-only form-data dependency needed.
function multipartPayload(parts: MultipartPart[]): {
  payload: Buffer;
  headers: Record<string, string>;
} {
  const chunks: Buffer[] = [];
  for (const part of parts) {
    chunks.push(Buffer.from(`--${BOUNDARY}\r\n`));
    if ('filename' in part) {
      chunks.push(
        Buffer.from(
          `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n` +
            `Content-Type: ${part.contentType}\r\n\r\n`,
        ),
      );
      chunks.push(part.data);
    } else {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${part.name}"\r\n\r\n`));
      chunks.push(Buffer.from(part.value));
    }
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return {
    payload: Buffer.concat(chunks),
    headers: { 'content-type': `multipart/form-data; boundary=${BOUNDARY}` },
  };
}

function listStorageFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...listStorageFiles(path));
    } else {
      found.push(path);
    }
  }
  return found;
}

describe('media (e2e)', () => {
  let testDb: TestDb;
  let app: NestFastifyApplication;
  let storageDir: string;
  let adminToken: string;
  let outsiderToken: string;

  async function login(email: string, password: string): Promise<Tokens> {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password },
    });
    expect(res.statusCode).toBe(200);
    return (res.json() as { data: Tokens }).data;
  }

  // Logs in, satisfies the forced password change, returns a usable token.
  async function loginFresh(
    email: string,
    tempPassword: string,
    newPassword: string,
  ): Promise<string> {
    const first = await login(email, tempPassword);
    const change = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      headers: { authorization: `Bearer ${first.accessToken}` },
      payload: { currentPassword: tempPassword, newPassword },
    });
    expect(change.statusCode).toBe(200);
    return (change.json() as { data: Tokens }).data.accessToken;
  }

  async function upload(
    token: string,
    file: { filename: string; contentType: string; data: Buffer },
    fields: Record<string, string> = {},
  ) {
    const { payload, headers } = multipartPayload([
      ...Object.entries(fields).map(([name, value]) => ({ name, value })),
      { name: 'file', ...file },
    ]);
    return app.inject({
      method: 'POST',
      url: '/media/files',
      headers: { ...headers, authorization: `Bearer ${token}` },
      payload,
    });
  }

  beforeAll(async () => {
    storageDir = mkdtempSync(join(tmpdir(), 'neriva-media-e2e-'));
    process.env.MEDIA_STORAGE_DIR = storageDir;
    process.env.MEDIA_MAX_UPLOAD_BYTES = String(MAX_UPLOAD_BYTES);
    // This suite asserts exact file counts in storageDir; the demo seed now
    // writes two real media files of its own (spec 13 "see it in action"
    // pages), which would throw those counts off, so it is disabled here
    // like the other demo-content-agnostic suites already do.
    process.env.SEED_DEMO = 'false';
    testDb = await startTestDb();
    app = await createTestApp(testDb.connectionUri);
    adminToken = await loginFresh('admin@neriva.com', 'admin', 'admin-password-1');

    // A user whose single role has no media grants at all (deny by default).
    const role = await app.inject({
      method: 'POST',
      url: '/roles',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'Site Viewer',
        permissions: [{ resourceType: 'site', action: 'read' }],
      },
    });
    expect(role.statusCode).toBe(201);
    const roleId = (role.json() as { data: { id: string } }).data.id;
    const user = await app.inject({
      method: 'POST',
      url: '/users',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        email: 'outsider@neriva.com',
        displayName: 'Outsider',
        password: 'outsider-temp-pass',
        roleIds: [roleId],
      },
    });
    expect(user.statusCode).toBe(201);
    outsiderToken = await loginFresh(
      'outsider@neriva.com',
      'outsider-temp-pass',
      'outsider-pass-1',
    );
  });

  afterAll(async () => {
    await app.close();
    await testDb.stop();
    delete process.env.MEDIA_STORAGE_DIR;
    delete process.env.MEDIA_MAX_UPLOAD_BYTES;
    delete process.env.SEED_DEMO;
    rmSync(storageDir, { recursive: true, force: true });
  });

  describe('upload and public delivery', () => {
    const pngBytes = Buffer.concat([
      Buffer.from('89504e470d0a1a0a', 'hex'),
      Buffer.from('fixture'),
    ]);
    let uploaded: FileData;

    it('uploads a file to the library root', async () => {
      const res = await upload(adminToken, {
        filename: 'logo.png',
        contentType: 'image/png',
        data: pngBytes,
      });
      expect(res.statusCode).toBe(201);
      uploaded = (res.json() as { data: FileData }).data;
      expect(uploaded.folderId).toBeNull();
      expect(uploaded.fileName).toBe('logo.png');
      expect(uploaded.contentType).toBe('image/png');
      expect(uploaded.sizeBytes).toBe(pngBytes.length);
      expect(uploaded.url).toBe(`/public/media/${uploaded.id}/logo.png`);
      expect(uploaded).not.toHaveProperty('storageKey');
      expect(listStorageFiles(storageDir)).toHaveLength(1);
    });

    it('sanitizes path-traversal display names', async () => {
      const res = await upload(adminToken, {
        filename: '../../etc/passwd.txt',
        contentType: 'text/plain',
        data: Buffer.from('not a real passwd'),
      });
      expect(res.statusCode).toBe(201);
      expect((res.json() as { data: FileData }).data.fileName).toBe('passwd.txt');
    });

    it('serves metadata with the computed public url', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/media/files/${uploaded.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = (res.json() as { data: FileData }).data;
      expect(body.url).toBe(uploaded.url);
      expect(body).not.toHaveProperty('storageKey');
    });

    it('streams the same bytes publicly without auth', async () => {
      const res = await app.inject({ method: 'GET', url: uploaded.url });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
      expect(res.rawPayload.equals(pngBytes)).toBe(true);
    });

    it('accepts any cosmetic file name segment', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/public/media/${uploaded.id}/whatever-name.bin`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.rawPayload.equals(pngBytes)).toBe(true);
    });

    it('returns 404 for unknown or malformed public ids', async () => {
      const unknown = await app.inject({
        method: 'GET',
        url: '/public/media/00000000-0000-7000-8000-000000000000/x',
      });
      expect(unknown.statusCode).toBe(404);
      const malformed = await app.inject({ method: 'GET', url: '/public/media/not-a-uuid/x' });
      expect(malformed.statusCode).toBe(404);
    });

    it('rejects empty files with 400', async () => {
      const res = await upload(adminToken, {
        filename: 'empty.txt',
        contentType: 'text/plain',
        data: Buffer.alloc(0),
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects a multipart body without the file field with 400', async () => {
      const { payload, headers } = multipartPayload([{ name: 'folderId', value: 'whatever' }]);
      const res = await app.inject({
        method: 'POST',
        url: '/media/files',
        headers: { ...headers, authorization: `Bearer ${adminToken}` },
        payload,
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects oversize uploads with 413', async () => {
      const res = await upload(adminToken, {
        filename: 'big.bin',
        contentType: 'application/octet-stream',
        data: Buffer.alloc(MAX_UPLOAD_BYTES + 1024, 1),
      });
      expect(res.statusCode).toBe(413);
    });
  });

  describe('site default folder', () => {
    let siteId: string;
    let siteFolderId: string;

    it('creates Sites/<site name> on first upload with a site ref', async () => {
      const site = await app.inject({
        method: 'POST',
        url: '/sites',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Marketing Site', slug: 'marketing' },
      });
      expect(site.statusCode).toBe(201);
      siteId = (site.json() as { data: { id: string } }).data.id;

      const res = await upload(
        adminToken,
        {
          filename: 'hero.jpg',
          contentType: 'image/jpeg',
          data: Buffer.concat([Buffer.from('ffd8ff', 'hex'), Buffer.from('jpeg-bytes')]),
        },
        { site: siteId },
      );
      expect(res.statusCode).toBe(201);
      const file = (res.json() as { data: FileData }).data;
      expect(file.folderId).not.toBeNull();
      siteFolderId = file.folderId as string;

      const rootFolders = await app.inject({
        method: 'GET',
        url: '/media/folders?parent=root',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(rootFolders.statusCode).toBe(200);
      const container = (rootFolders.json() as { data: FolderData[] }).data.find(
        (folder) => folder.name === 'Sites',
      );
      expect(container).toBeDefined();

      const children = await app.inject({
        method: 'GET',
        url: `/media/folders?parent=${container?.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const siteFolder = (children.json() as { data: FolderData[] }).data.find(
        (folder) => folder.id === siteFolderId,
      );
      expect(siteFolder).toMatchObject({
        name: 'Marketing Site',
        siteId,
        externalReferenceCode: 'site-media-marketing',
      });
    });

    it('reuses the same folder on the second upload (idempotent)', async () => {
      const res = await upload(
        adminToken,
        {
          filename: 'hero2.jpg',
          contentType: 'image/jpeg',
          data: Buffer.concat([Buffer.from('ffd8ff', 'hex'), Buffer.from('more-jpeg')]),
        },
        { site: siteId },
      );
      expect(res.statusCode).toBe(201);
      expect((res.json() as { data: FileData }).data.folderId).toBe(siteFolderId);
    });

    it('returns 404 for an unknown site ref', async () => {
      const res = await upload(
        adminToken,
        {
          filename: 'lost.jpg',
          contentType: 'image/jpeg',
          data: Buffer.concat([Buffer.from('ffd8ff', 'hex'), Buffer.from('lost')]),
        },
        { site: 'erc:no-such-site' },
      );
      expect(res.statusCode).toBe(404);
    });

    it('prefers folderId over site when both are sent', async () => {
      const folder = await app.inject({
        method: 'POST',
        url: '/media/folders',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Explicit Target' },
      });
      const folderId = (folder.json() as { data: FolderData }).data.id;
      const res = await upload(
        adminToken,
        { filename: 'both.txt', contentType: 'text/plain', data: Buffer.from('x') },
        { site: siteId, folderId },
      );
      expect(res.statusCode).toBe(201);
      expect((res.json() as { data: FileData }).data.folderId).toBe(folderId);
    });
  });

  describe('folders and file management', () => {
    let docsFolder: FolderData;
    let reportsFolder: FolderData;
    let movedFile: FileData;

    it('creates folders and rejects sibling name duplicates with 409', async () => {
      const docs = await app.inject({
        method: 'POST',
        url: '/media/folders',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Docs' },
      });
      expect(docs.statusCode).toBe(201);
      docsFolder = (docs.json() as { data: FolderData }).data;
      expect(docsFolder.parentId).toBeNull();
      expect(docsFolder.siteId).toBeNull();

      const duplicate = await app.inject({
        method: 'POST',
        url: '/media/folders',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Docs' },
      });
      expect(duplicate.statusCode).toBe(409);

      const child = await app.inject({
        method: 'POST',
        url: '/media/folders',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Docs', parent: docsFolder.id },
      });
      expect(child.statusCode).toBe(201);
      reportsFolder = (child.json() as { data: FolderData }).data;
      expect(reportsFolder.parentId).toBe(docsFolder.id);
    });

    it('renames a folder', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/media/folders/${reportsFolder.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'Reports' },
      });
      expect(res.statusCode).toBe(200);
      expect((res.json() as { data: FolderData }).data.name).toBe('Reports');
    });

    it('refuses to move a folder into its own subtree', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/media/folders/${docsFolder.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { parent: reportsFolder.id },
      });
      expect(res.statusCode).toBe(400);
    });

    it('moves a file between folders and edits alt text', async () => {
      const created = await upload(adminToken, {
        filename: 'report.pdf',
        contentType: 'application/pdf',
        data: Buffer.from('%PDF-1.7\nfixture'),
      });
      movedFile = (created.json() as { data: FileData }).data;

      const res = await app.inject({
        method: 'PATCH',
        url: `/media/files/${movedFile.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { folderId: reportsFolder.id, fileName: 'annual-report.pdf', alt: 'Report' },
      });
      expect(res.statusCode).toBe(200);
      const updated = (res.json() as { data: FileData }).data;
      expect(updated.folderId).toBe(reportsFolder.id);
      expect(updated.fileName).toBe('annual-report.pdf');
      expect(updated.alt).toBe('Report');
      expect(updated.url).toBe(`/public/media/${movedFile.id}/annual-report.pdf`);

      const listing = await app.inject({
        method: 'GET',
        url: `/media/files?folder=${reportsFolder.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const ids = (listing.json() as { data: FileData[] }).data.map((file) => file.id);
      expect(ids).toContain(movedFile.id);
    });

    it('searches files by name across every folder, ignoring the folder filter', async () => {
      // movedFile ("annual-report.pdf") lives in reportsFolder; a root-scoped
      // search must still find it because search takes priority over folder.
      const res = await app.inject({
        method: 'GET',
        url: `/media/files?folder=root&search=annual-rep`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const found = (res.json() as { data: FileData[] }).data;
      expect(found.map((file) => file.id)).toContain(movedFile.id);

      const noMatch = await app.inject({
        method: 'GET',
        url: '/media/files?search=no-such-file-xyz',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(noMatch.statusCode).toBe(200);
      expect((noMatch.json() as { data: FileData[] }).data).toEqual([]);
    });

    it('still 404s on an invalid folder ref even when a search term is also given', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/media/files?folder=erc:no-such-folder&search=annual',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('escapes LIKE wildcard characters in the search term so % and _ match literally', async () => {
      const percentCreated = await upload(adminToken, {
        filename: '50%-off.png',
        contentType: 'image/png',
        data: Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from('fixture')]),
      });
      expect(percentCreated.statusCode).toBe(201);
      const percentFile = (percentCreated.json() as { data: FileData }).data;

      // If "%" were treated as a wildcard, searching "50%" would become the
      // pattern %50%%, matching every file whose name contains "50" followed
      // by anything (e.g. this suite's other "50X-something" fixtures).
      const percentDecoy = await upload(adminToken, {
        filename: '50X-decoy.png',
        contentType: 'image/png',
        data: Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from('fixture')]),
      });
      expect(percentDecoy.statusCode).toBe(201);

      const percentMatch = await app.inject({
        method: 'GET',
        url: `/media/files?search=${encodeURIComponent('50%-off')}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(percentMatch.statusCode).toBe(200);
      expect((percentMatch.json() as { data: FileData[] }).data.map((file) => file.id)).toEqual([
        percentFile.id,
      ]);

      // If "_" were treated as a wildcard (matches any single character),
      // searching "off_final" would also match "offXfinal".
      const underscoreCreated = await upload(adminToken, {
        filename: 'off_final.png',
        contentType: 'image/png',
        data: Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from('fixture')]),
      });
      expect(underscoreCreated.statusCode).toBe(201);
      const underscoreFile = (underscoreCreated.json() as { data: FileData }).data;

      const underscoreDecoy = await upload(adminToken, {
        filename: 'offXfinal.png',
        contentType: 'image/png',
        data: Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from('fixture')]),
      });
      expect(underscoreDecoy.statusCode).toBe(201);

      const underscoreMatch = await app.inject({
        method: 'GET',
        url: `/media/files?search=${encodeURIComponent('off_final')}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(underscoreMatch.statusCode).toBe(200);
      expect((underscoreMatch.json() as { data: FileData[] }).data.map((file) => file.id)).toEqual([
        underscoreFile.id,
      ]);
    });

    it('deletes a file and removes its bytes from disk', async () => {
      const before = listStorageFiles(storageDir).length;
      const res = await app.inject({
        method: 'DELETE',
        url: `/media/files/${movedFile.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(204);
      expect(listStorageFiles(storageDir)).toHaveLength(before - 1);

      const gone = await app.inject({
        method: 'GET',
        url: `/media/files/${movedFile.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(gone.statusCode).toBe(404);
    });

    it('cascade-deletes subfolders and files, removing bytes', async () => {
      const inSubfolder = await upload(
        adminToken,
        { filename: 'nested.txt', contentType: 'text/plain', data: Buffer.from('nested') },
        { folderId: reportsFolder.id },
      );
      expect(inSubfolder.statusCode).toBe(201);
      const before = listStorageFiles(storageDir).length;

      const res = await app.inject({
        method: 'DELETE',
        url: `/media/folders/${docsFolder.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(204);
      expect(listStorageFiles(storageDir)).toHaveLength(before - 1);

      const subfolderGone = await app.inject({
        method: 'GET',
        url: `/media/folders?parent=${reportsFolder.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(subfolderGone.statusCode).toBe(404);
    });
  });

  describe('permissions', () => {
    it('denies every media action to a role without media grants', async () => {
      const list = await app.inject({
        method: 'GET',
        url: '/media/files',
        headers: { authorization: `Bearer ${outsiderToken}` },
      });
      expect(list.statusCode).toBe(403);
      expect(list.json()).toMatchObject({ status: 403, code: 'PERMISSION_DENIED' });

      const uploadRes = await upload(outsiderToken, {
        filename: 'nope.txt',
        contentType: 'text/plain',
        data: Buffer.from('nope'),
      });
      expect(uploadRes.statusCode).toBe(403);

      const folders = await app.inject({
        method: 'GET',
        url: '/media/folders',
        headers: { authorization: `Bearer ${outsiderToken}` },
      });
      expect(folders.statusCode).toBe(403);
    });

    it('requires authentication on the management endpoints', async () => {
      const res = await app.inject({ method: 'GET', url: '/media/files' });
      expect(res.statusCode).toBe(401);
    });
  });
});
