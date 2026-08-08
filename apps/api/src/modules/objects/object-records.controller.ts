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
import { ApiBearerAuth, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { ApiDataResponse, ApiListResponse } from '../../common/api-envelope.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../roles/require-permission.decorator';
import { ObjectRecordDto } from './dto/object-response.dto';
import {
  CreateObjectRecordDto,
  ListObjectRecordsQueryDto,
  UpdateObjectRecordDto,
} from './dto/object-records.dto';
import { ObjectRecordsService, type ObjectRecordRow } from './object-records.service';

interface RecordResponse {
  data: ObjectRecordRow;
}

const ID_PARAM = { name: 'id', description: 'UUID or erc:<externalReferenceCode>' };
const DEF_REF_PARAM = {
  name: 'defRef',
  description: 'Object definition UUID or erc:<externalReferenceCode>',
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

@ApiTags('object-records')
@ApiBearerAuth()
@Controller()
export class ObjectRecordsController {
  constructor(private readonly recordsService: ObjectRecordsService) {}

  @Get('object-definitions/:defRef/records')
  @ApiParam(DEF_REF_PARAM)
  @ApiQuery(FILTER_QUERY)
  @ApiListResponse(ObjectRecordDto)
  @RequirePermission('object-record:read')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('defRef') defRef: string,
    @Query() query: ListObjectRecordsQueryDto,
    // Raw query string access: filter[<fieldKey>] keys are runtime-defined,
    // so they cannot live on a whitelisted DTO.
    @Req() request: FastifyRequest,
  ): Promise<{ data: ObjectRecordRow[]; meta: { cursor: string | null; limit: number } }> {
    const rawQuery = request.query as Record<string, unknown>;
    const page = await this.recordsService.listByDefinition(user.tenantId, defRef, query, rawQuery);
    return { data: page.items, meta: { cursor: page.nextCursor, limit: page.limit } };
  }

  @Post('object-definitions/:defRef/records')
  @ApiParam(DEF_REF_PARAM)
  @ApiDataResponse(ObjectRecordDto, { status: 201 })
  @RequirePermission('object-record:create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('defRef') defRef: string,
    @Body() dto: CreateObjectRecordDto,
  ): Promise<RecordResponse> {
    return { data: await this.recordsService.create(user.tenantId, user.id, defRef, dto) };
  }

  @Get('object-records/:id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(ObjectRecordDto)
  @RequirePermission('object-record:read')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<RecordResponse> {
    return { data: await this.recordsService.getByRef(user.tenantId, id) };
  }

  @Patch('object-records/:id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(ObjectRecordDto)
  @RequirePermission('object-record:update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateObjectRecordDto,
  ): Promise<RecordResponse> {
    return { data: await this.recordsService.update(user.tenantId, id, dto) };
  }

  @Delete('object-records/:id')
  @ApiParam(ID_PARAM)
  @RequirePermission('object-record:delete')
  @HttpCode(204)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.recordsService.delete(user.tenantId, id);
  }
}
