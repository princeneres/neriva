import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { ApiDataResponse, ApiListResponse } from '../../common/api-envelope.decorators';
import { Public } from '../auth/auth.decorators';
import {
  PublicCreateObjectRecordDto,
  PublicObjectDefinitionDto,
  PublicObjectRecordDto,
  PublicUpdateObjectRecordDto,
} from './dto/public-objects.dto';
import { ListObjectRecordsQueryDto } from './dto/object-records.dto';
import {
  PublicObjectsService,
  type PublicObjectDefinition,
  type PublicObjectRecord,
} from './public-objects.service';

const DEF_REF_PARAM = {
  name: 'defRef',
  description: 'Object definition UUID or erc:<externalReferenceCode>',
};
const RECORD_ID_PARAM = {
  name: 'recordId',
  description: 'Object record UUID or erc:<externalReferenceCode>',
};
const FILTER_QUERY = {
  name: 'filter',
  required: false,
  style: 'deepObject' as const,
  explode: true,
  schema: { type: 'object' as const, additionalProperties: { type: 'string' as const } },
  description:
    'Equality filters on definition field keys, e.g. filter[status]=open. ' +
    'Multiple filters are ANDed; values are coerced by the field type; unknown keys are a 400.',
};

// Anonymous reads stay well above what a page load costs (a definition plus a
// record page), while still capping a scraper walking the cursor.
const PUBLIC_READ_THROTTLE = { default: { limit: 120, ttl: 60_000 } };
// Anonymous writes are the abuse surface: no account, no audit trail, nothing
// to revoke. Per IP, in-memory, same mechanism as the login limit. It honours
// TRUST_PROXY, so the client IP is the real one behind a configured proxy.
const PUBLIC_WRITE_THROTTLE = { default: { limit: 20, ttl: 60_000 } };

/**
 * Anonymous surface for Objects (spec 05, delivery conventions of spec 10).
 *
 * It lives in the Objects module rather than in Delivery on purpose: delivery
 * is site scoped and read only by definition, while this is tenant scoped and
 * carries writes. What it borrows from delivery is the /public prefix, the
 * "no bearer token" contract and the rule that the management envelope is
 * never exposed.
 *
 * There is no GET /public/object-definitions: a visitor can only address a
 * definition it already knows the reference of, so the tenant's data model
 * cannot be enumerated.
 */
@ApiTags('public-objects')
@Controller('public/object-definitions')
export class PublicObjectsController {
  constructor(private readonly publicObjects: PublicObjectsService) {}

  @Public()
  @Throttle(PUBLIC_READ_THROTTLE)
  @Get(':defRef')
  @ApiParam(DEF_REF_PARAM)
  @ApiDataResponse(PublicObjectDefinitionDto)
  async definition(@Param('defRef') defRef: string): Promise<{ data: PublicObjectDefinition }> {
    return { data: await this.publicObjects.getDefinition(defRef) };
  }

  @Public()
  @Throttle(PUBLIC_READ_THROTTLE)
  @Get(':defRef/records')
  @ApiParam(DEF_REF_PARAM)
  @ApiQuery(FILTER_QUERY)
  @ApiListResponse(PublicObjectRecordDto)
  async listRecords(
    @Param('defRef') defRef: string,
    @Query() query: ListObjectRecordsQueryDto,
    // Raw query string access: filter[<fieldKey>] keys are runtime-defined,
    // so they cannot live on a whitelisted DTO.
    @Req() request: FastifyRequest,
  ): Promise<{ data: PublicObjectRecord[]; meta: { cursor: string | null; limit: number } }> {
    const rawQuery = request.query as Record<string, unknown>;
    const page = await this.publicObjects.listRecords(defRef, query, rawQuery);
    return { data: page.items, meta: { cursor: page.nextCursor, limit: page.limit } };
  }

  @Public()
  @Throttle(PUBLIC_WRITE_THROTTLE)
  @Post(':defRef/records')
  @ApiParam(DEF_REF_PARAM)
  @ApiDataResponse(PublicObjectRecordDto, { status: 201 })
  async createRecord(
    @Param('defRef') defRef: string,
    @Body() dto: PublicCreateObjectRecordDto,
  ): Promise<{ data: PublicObjectRecord }> {
    return { data: await this.publicObjects.createRecord(defRef, dto) };
  }

  @Public()
  @Throttle(PUBLIC_WRITE_THROTTLE)
  @Patch(':defRef/records/:recordId')
  @ApiParam(DEF_REF_PARAM)
  @ApiParam(RECORD_ID_PARAM)
  @ApiDataResponse(PublicObjectRecordDto)
  async updateRecord(
    @Param('defRef') defRef: string,
    @Param('recordId') recordId: string,
    @Body() dto: PublicUpdateObjectRecordDto,
  ): Promise<{ data: PublicObjectRecord }> {
    return { data: await this.publicObjects.updateRecord(defRef, recordId, dto) };
  }

  @Public()
  @Throttle(PUBLIC_WRITE_THROTTLE)
  @Delete(':defRef/records/:recordId')
  @ApiParam(DEF_REF_PARAM)
  @ApiParam(RECORD_ID_PARAM)
  @HttpCode(204)
  async deleteRecord(
    @Param('defRef') defRef: string,
    @Param('recordId') recordId: string,
  ): Promise<void> {
    await this.publicObjects.deleteRecord(defRef, recordId);
  }
}
