import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { CursorPage } from '../../db/tenant-scoped.repository';
import { DB, type Database } from '../../db/database';
import { tenants, type ObjectFieldDefinition, type ObjectPublicAccess } from '../../db/schema';
import { DEFAULT_TENANT_ERC } from '../../db/seed.service';
import { PUBLIC_RECORD_SIZE_LIMITS } from './object-field.validation';
import { ObjectDefinitionsService, type ObjectDefinitionRow } from './object-definitions.service';
import { ObjectRecordsService, type ObjectRecordRow } from './object-records.service';

// What an anonymous caller is allowed to see of a definition: enough to render
// a form and a list, and nothing from the management envelope. tenantId,
// createdBy and folderId stay on the authenticated side. publicAccess is
// included because a client needs to know whether to offer an editor, and it
// reveals nothing a single POST would not: it is never 'none' here.
export interface PublicObjectDefinition {
  id: string;
  externalReferenceCode: string;
  name: string;
  pluralName: string;
  description: string | null;
  publicAccess: Exclude<ObjectPublicAccess, 'none'>;
  fields: ObjectFieldDefinition[];
}

// Same idea for a record: the payload plus the handles a client needs to
// update or delete it. createdBy would leak a user id, tenantId is noise.
export interface PublicObjectRecord {
  id: string;
  externalReferenceCode: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// A definition that passed the publicAccess gate; the narrowed type keeps the
// gate from being skipped further down.
type PublishedDefinition = ObjectDefinitionRow & {
  publicAccess: Exclude<ObjectPublicAccess, 'none'>;
};

function toPublicDefinition(row: PublishedDefinition): PublicObjectDefinition {
  return {
    id: row.id,
    externalReferenceCode: row.externalReferenceCode,
    name: row.name,
    pluralName: row.pluralName,
    description: row.description,
    publicAccess: row.publicAccess,
    fields: row.fields,
  };
}

function toPublicRecord(row: ObjectRecordRow): PublicObjectRecord {
  return {
    id: row.id,
    externalReferenceCode: row.externalReferenceCode,
    data: row.data,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Anonymous surface for Objects (spec 05).
 *
 * Every entry point starts from a single definition reference the caller
 * already knows: there is no public listing of definitions, so a visitor can
 * never enumerate the tenant's data model. A definition whose publicAccess is
 * 'none', and one that does not exist, are answered identically (404), so the
 * surface is not an existence oracle either.
 */
@Injectable()
export class PublicObjectsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly definitionsService: ObjectDefinitionsService,
    private readonly recordsService: ObjectRecordsService,
  ) {}

  // v1 ships single-tenant deploys; the public surface always targets the
  // default tenant, the same way delivery and login do.
  private async resolveTenantId(): Promise<string> {
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

  private async resolveDefinition(
    ref: string,
    intent: 'read' | 'write',
  ): Promise<{ tenantId: string; definition: PublishedDefinition }> {
    const tenantId = await this.resolveTenantId();
    let definition: ObjectDefinitionRow;
    try {
      definition = await this.definitionsService.getByRef(tenantId, ref);
    } catch (error) {
      // A malformed reference stays a 400, like everywhere else; only "no such
      // row" is folded into the shared 404 below.
      if (!(error instanceof NotFoundException)) {
        throw error;
      }
      throw this.notFound(ref);
    }
    const { publicAccess } = definition;
    if (publicAccess === 'none') {
      throw this.notFound(ref);
    }
    // Existence is already public at this point, so refusing the write can be
    // honest about why instead of pretending the object is gone.
    if (intent === 'write' && publicAccess !== 'read-write') {
      throw new ForbiddenException({
        detail: `Object "${definition.name}" is published read-only; anonymous writes are not allowed`,
      });
    }
    return { tenantId, definition: { ...definition, publicAccess } };
  }

  private notFound(ref: string): NotFoundException {
    return new NotFoundException({ detail: `Public object definition ${ref} not found` });
  }

  async getDefinition(ref: string): Promise<PublicObjectDefinition> {
    const { definition } = await this.resolveDefinition(ref, 'read');
    return toPublicDefinition(definition);
  }

  async listRecords(
    ref: string,
    query: { limit?: number; cursor?: string; sort?: string; search?: string },
    rawQuery: Record<string, unknown>,
  ): Promise<CursorPage<PublicObjectRecord>> {
    const { tenantId, definition } = await this.resolveDefinition(ref, 'read');
    const page = await this.recordsService.listByDefinition(
      tenantId,
      definition.id,
      query,
      rawQuery,
    );
    return { ...page, items: page.items.map(toPublicRecord) };
  }

  async createRecord(
    ref: string,
    input: { data: Record<string, unknown> },
  ): Promise<PublicObjectRecord> {
    const { tenantId, definition } = await this.resolveDefinition(ref, 'write');
    // createdBy null: an anonymous write has no account behind it. The ERC is
    // never taken from the caller either, so a visitor cannot squat on a code
    // an integration relies on.
    const created = await this.recordsService.create(
      tenantId,
      null,
      definition.id,
      { data: input.data },
      PUBLIC_RECORD_SIZE_LIMITS,
    );
    return toPublicRecord(created);
  }

  // Records are addressed by id under the definition that owns them, never by
  // a bare /object-records/:id route: resolving the definition first is what
  // keeps a read-write object from becoming a handle on every other object's
  // records.
  async updateRecord(
    ref: string,
    recordId: string,
    input: { data: Record<string, unknown> },
  ): Promise<PublicObjectRecord> {
    const { tenantId, record } = await this.resolveRecord(ref, recordId);
    const updated = await this.recordsService.update(
      tenantId,
      record.id,
      { data: input.data },
      PUBLIC_RECORD_SIZE_LIMITS,
    );
    return toPublicRecord(updated);
  }

  async deleteRecord(ref: string, recordId: string): Promise<void> {
    const { tenantId, record } = await this.resolveRecord(ref, recordId);
    await this.recordsService.delete(tenantId, record.id);
  }

  private async resolveRecord(
    ref: string,
    recordId: string,
  ): Promise<{ tenantId: string; record: ObjectRecordRow }> {
    const { tenantId, definition } = await this.resolveDefinition(ref, 'write');
    let record: ObjectRecordRow;
    try {
      record = await this.recordsService.getByRef(tenantId, recordId);
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }
      throw new NotFoundException({ detail: `Object record ${recordId} not found` });
    }
    if (record.objectDefinitionId !== definition.id) {
      throw new NotFoundException({ detail: `Object record ${recordId} not found` });
    }
    return { tenantId, record };
  }
}
