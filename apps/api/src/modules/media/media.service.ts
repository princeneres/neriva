import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, gt, ilike, inArray, isNull, type InferSelectModel } from 'drizzle-orm';
import { clampLimit, decodeCursor, encodeCursor } from '../../common/pagination';
import { isUniqueViolation } from '../../common/pg-errors';
import { DB, type Database } from '../../db/database';
import { mediaFiles, mediaFolders, tenants } from '../../db/schema';
import { DEFAULT_TENANT_ERC } from '../../db/seed.service';
import { TenantScopedRepository, type CursorPage } from '../../db/tenant-scoped.repository';
import { SitesService } from '../sites/sites.service';
import { sanitizeFileName } from './file-name';
import { StorageService } from './storage.service';
import { validateUploadSignature } from './file-signature';

export type MediaFolderRow = InferSelectModel<typeof mediaFolders>;
export type MediaFileRow = InferSelectModel<typeof mediaFiles>;

// API shape of a file: the storage key stays internal, the public content URL
// is computed (spec 11).
export interface MediaFileResponse extends Omit<MediaFileRow, 'storageKey'> {
  url: string;
}

export function toMediaFileResponse(row: MediaFileRow): MediaFileResponse {
  const { storageKey, ...rest } = row;
  return { ...rest, url: `/public/media/${row.id}/${encodeURIComponent(row.fileName)}` };
}

// Name of the root container that groups per-site default folders
// (spec 11: "Sites/<site name>").
const SITES_CONTAINER_NAME = 'Sites';

const FOLDER_DUPLICATE_DETAIL = 'A folder with this name or ERC already exists in this location';

function toPage<T extends { id: string }>(rows: T[], limit: number): CursorPage<T> {
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  const nextCursor = rows.length > limit && last ? encodeCursor(last.id) : null;
  return { items, nextCursor, limit };
}

// Postgres treats \, % and _ as special inside a LIKE/ILIKE pattern
// (backslash is the default escape character); a raw user search term must
// have all three escaped so it matches as a literal substring instead of a
// wildcard pattern.
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

@Injectable()
export class MediaService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly sitesService: SitesService,
    private readonly storage: StorageService,
  ) {}

  private folders(tenantId: string): TenantScopedRepository<typeof mediaFolders> {
    return new TenantScopedRepository(this.db, mediaFolders, tenantId);
  }

  private files(tenantId: string): TenantScopedRepository<typeof mediaFiles> {
    return new TenantScopedRepository(this.db, mediaFiles, tenantId);
  }

  // ---- folders ----

  async getFolderByRef(tenantId: string, ref: string): Promise<MediaFolderRow> {
    const folder = await this.folders(tenantId).findByRef(ref);
    if (!folder) {
      throw new NotFoundException({ detail: `Media folder ${ref} not found` });
    }
    return folder;
  }

  // "root" or undefined lists the top level; otherwise a folder ref.
  async listFolders(
    tenantId: string,
    params: { parent?: string; limit?: number; cursor?: string },
  ): Promise<CursorPage<MediaFolderRow>> {
    const parentCondition =
      params.parent === undefined || params.parent === 'root'
        ? isNull(mediaFolders.parentId)
        : eq(mediaFolders.parentId, (await this.getFolderByRef(tenantId, params.parent)).id);
    // Mirrors the TenantScopedRepository pagination with one extra filter;
    // the generic repository has no extra-filter support (same trade-off as
    // the content module).
    const limit = clampLimit(params.limit);
    const rows = await this.db
      .select()
      .from(mediaFolders)
      .where(
        and(
          eq(mediaFolders.tenantId, tenantId),
          parentCondition,
          params.cursor ? gt(mediaFolders.id, decodeCursor(params.cursor).id) : undefined,
        ),
      )
      .orderBy(asc(mediaFolders.id))
      .limit(limit + 1);
    return toPage(rows, limit);
  }

  async createFolder(
    tenantId: string,
    createdBy: string,
    input: { name: string; parent?: string; externalReferenceCode?: string },
  ): Promise<MediaFolderRow> {
    const parent =
      input.parent === undefined ? null : await this.getFolderByRef(tenantId, input.parent);
    try {
      // Intermediate variable: tsc cannot apply the excess-property check to
      // the generic repository parameter and rejects fresh literals here.
      const values = {
        name: input.name,
        parentId: parent?.id ?? null,
        createdBy,
        // undefined lets the envelope default generate one
        externalReferenceCode: input.externalReferenceCode,
      };
      return await this.folders(tenantId).create(values);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ detail: FOLDER_DUPLICATE_DETAIL });
      }
      throw error;
    }
  }

  async updateFolder(
    tenantId: string,
    ref: string,
    input: { name?: string; parent?: string | null },
  ): Promise<MediaFolderRow> {
    const existing = await this.getFolderByRef(tenantId, ref);
    const values: Partial<{ name: string; parentId: string | null }> = {};
    if (input.name !== undefined) {
      values.name = input.name;
    }
    if (input.parent !== undefined) {
      if (input.parent === null) {
        values.parentId = null;
      } else {
        const target = await this.getFolderByRef(tenantId, input.parent);
        // A folder cannot become a child of itself or of its own subtree.
        if (target.id === existing.id) {
          throw new BadRequestException({ detail: 'Cannot move a folder into itself' });
        }
        const descendants = await this.collectDescendantFolderIds(tenantId, existing.id);
        if (descendants.includes(target.id)) {
          throw new BadRequestException({ detail: 'Cannot move a folder into its own subtree' });
        }
        values.parentId = target.id;
      }
    }
    if (Object.keys(values).length === 0) {
      return existing;
    }
    try {
      const updated = await this.folders(tenantId).updateById(existing.id, values);
      return updated ?? existing;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException({ detail: FOLDER_DUPLICATE_DETAIL });
      }
      throw error;
    }
  }

  // Cascades to subfolders and files via FK; physical bytes are removed
  // best-effort after the rows are gone (spec 11).
  async deleteFolder(tenantId: string, ref: string): Promise<void> {
    const existing = await this.getFolderByRef(tenantId, ref);
    const folderIds = [
      existing.id,
      ...(await this.collectDescendantFolderIds(tenantId, existing.id)),
    ];
    const doomed = await this.db
      .select({ storageKey: mediaFiles.storageKey })
      .from(mediaFiles)
      .where(and(eq(mediaFiles.tenantId, tenantId), inArray(mediaFiles.folderId, folderIds)));
    await this.folders(tenantId).deleteById(existing.id);
    for (const row of doomed) {
      await this.storage.delete(row.storageKey);
    }
  }

  // ---- files ----

  async getFileByRef(tenantId: string, ref: string): Promise<MediaFileRow> {
    const file = await this.files(tenantId).findByRef(ref);
    if (!file) {
      throw new NotFoundException({ detail: `Media file ${ref} not found` });
    }
    return file;
  }

  // Anonymous content delivery always targets the default tenant, the same
  // way spec 10 delivery does. Malformed refs are indistinguishable from
  // missing files on purpose.
  async getPublicFileByRef(ref: string): Promise<MediaFileRow> {
    const tenantId = await this.resolveDefaultTenantId();
    let file: MediaFileRow | null = null;
    try {
      file = await this.files(tenantId).findByRef(ref);
    } catch (error) {
      if (!(error instanceof BadRequestException)) {
        throw error;
      }
    }
    if (!file) {
      throw new NotFoundException({ detail: 'Media file not found' });
    }
    return file;
  }

  async listFiles(
    tenantId: string,
    params: { folder?: string; search?: string; limit?: number; cursor?: string },
  ): Promise<CursorPage<MediaFileRow>> {
    // A search term looks across every folder in the tenant, so folder does
    // not scope the query; it is still validated when given, so a stale or
    // mistyped folder ref 404s instead of silently falling back to a
    // tenant-wide search.
    const search = params.search?.trim();
    const folderId =
      params.folder === undefined || params.folder === 'root'
        ? null
        : (await this.getFolderByRef(tenantId, params.folder)).id;
    const folderCondition = search
      ? undefined
      : folderId === null
        ? isNull(mediaFiles.folderId)
        : eq(mediaFiles.folderId, folderId);
    const limit = clampLimit(params.limit);
    const rows = await this.db
      .select()
      .from(mediaFiles)
      .where(
        and(
          eq(mediaFiles.tenantId, tenantId),
          folderCondition,
          search ? ilike(mediaFiles.fileName, `%${escapeLikePattern(search)}%`) : undefined,
          params.cursor ? gt(mediaFiles.id, decodeCursor(params.cursor).id) : undefined,
        ),
      )
      .orderBy(asc(mediaFiles.id))
      .limit(limit + 1);
    return toPage(rows, limit);
  }

  async uploadFile(
    tenantId: string,
    createdBy: string,
    input: {
      fileName: string;
      contentType: string;
      bytes: Buffer;
      folderId?: string;
      site?: string;
    },
  ): Promise<MediaFileRow> {
    if (input.bytes.length === 0) {
      throw new BadRequestException({ detail: 'Empty files are rejected' });
    }
    const contentType = validateUploadSignature(input.contentType, input.bytes);
    let folderId: string | null = null;
    if (input.folderId !== undefined) {
      folderId = (await this.getFolderByRef(tenantId, input.folderId)).id;
    } else if (input.site !== undefined) {
      folderId = (await this.ensureSiteDefaultFolder(tenantId, createdBy, input.site)).id;
    }

    const fileName = sanitizeFileName(input.fileName);
    const storageKey = this.storage.generateKey(fileName);
    await this.storage.write(storageKey, input.bytes);
    try {
      const values = {
        folderId,
        fileName,
        contentType,
        sizeBytes: input.bytes.length,
        storageKey,
        createdBy,
      };
      return await this.files(tenantId).create(values);
    } catch (error) {
      // The row is the source of truth; orphaned bytes are removed.
      await this.storage.delete(storageKey);
      throw error;
    }
  }

  async updateFile(
    tenantId: string,
    ref: string,
    input: { fileName?: string; alt?: string | null; folderId?: string | null },
  ): Promise<MediaFileRow> {
    const existing = await this.getFileByRef(tenantId, ref);
    const values: Partial<{ fileName: string; alt: string | null; folderId: string | null }> = {};
    if (input.fileName !== undefined) {
      values.fileName = sanitizeFileName(input.fileName);
    }
    if (input.alt !== undefined) {
      values.alt = input.alt;
    }
    if (input.folderId !== undefined) {
      values.folderId =
        input.folderId === null ? null : (await this.getFolderByRef(tenantId, input.folderId)).id;
    }
    if (Object.keys(values).length === 0) {
      return existing;
    }
    const updated = await this.files(tenantId).updateById(existing.id, values);
    return updated ?? existing;
  }

  async deleteFile(tenantId: string, ref: string): Promise<void> {
    const existing = await this.getFileByRef(tenantId, ref);
    await this.files(tenantId).deleteById(existing.id);
    await this.storage.delete(existing.storageKey);
  }

  // ---- helpers ----

  // Default folder "Sites/<site name>" (spec 11): a per-site folder with
  // siteId set and ERC site-media-<slug>, inside a shared root container
  // named "Sites". Idempotent, race-safe via the unique constraints.
  private async ensureSiteDefaultFolder(
    tenantId: string,
    createdBy: string,
    siteRef: string,
  ): Promise<MediaFolderRow> {
    const site = await this.sitesService.getByRef(tenantId, siteRef);
    const erc = `site-media-${site.slug}`;
    const existing = await this.folders(tenantId).findByErc(erc);
    if (existing) {
      return existing;
    }
    const container = await this.ensureSitesContainer(tenantId, createdBy);
    try {
      const values = {
        name: site.name,
        parentId: container.id,
        siteId: site.id,
        createdBy,
        externalReferenceCode: erc,
      };
      return await this.folders(tenantId).create(values);
    } catch (error) {
      if (isUniqueViolation(error)) {
        const winner = await this.folders(tenantId).findByErc(erc);
        if (winner) {
          return winner;
        }
        // Not an ERC race: a sibling folder already uses this site's name.
        throw new ConflictException({ detail: FOLDER_DUPLICATE_DETAIL });
      }
      throw error;
    }
  }

  private async ensureSitesContainer(tenantId: string, createdBy: string): Promise<MediaFolderRow> {
    const find = async (): Promise<MediaFolderRow | null> =>
      (
        await this.db
          .select()
          .from(mediaFolders)
          .where(
            and(
              eq(mediaFolders.tenantId, tenantId),
              isNull(mediaFolders.parentId),
              eq(mediaFolders.name, SITES_CONTAINER_NAME),
            ),
          )
          .limit(1)
      )[0] ?? null;

    const existing = await find();
    if (existing) {
      return existing;
    }
    try {
      const values = { name: SITES_CONTAINER_NAME, parentId: null, createdBy };
      return await this.folders(tenantId).create(values);
    } catch (error) {
      if (isUniqueViolation(error)) {
        const winner = await find();
        if (winner) {
          return winner;
        }
      }
      throw error;
    }
  }

  // Breadth-first walk over parentId; folder trees are shallow, so one query
  // per level is fine and keeps the code obvious.
  private async collectDescendantFolderIds(tenantId: string, rootId: string): Promise<string[]> {
    const collected: string[] = [];
    let frontier = [rootId];
    while (frontier.length > 0) {
      const rows = await this.db
        .select({ id: mediaFolders.id })
        .from(mediaFolders)
        .where(and(eq(mediaFolders.tenantId, tenantId), inArray(mediaFolders.parentId, frontier)));
      frontier = rows.map((row) => row.id);
      collected.push(...frontier);
    }
    return collected;
  }

  private async resolveDefaultTenantId(): Promise<string> {
    const tenant = (
      await this.db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.externalReferenceCode, DEFAULT_TENANT_ERC))
        .limit(1)
    )[0];
    if (!tenant) {
      throw new NotFoundException({ detail: 'Default tenant is not provisioned' });
    }
    return tenant.id;
  }
}
