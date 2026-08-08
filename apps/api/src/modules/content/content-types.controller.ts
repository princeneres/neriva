import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiDataResponse, ApiListResponse } from '../../common/api-envelope.decorators';
import { ListQueryDto } from '../../common/list-query.dto';
import { CurrentUser } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../roles/require-permission.decorator';
import { ContentTypesService, type ContentTypeRow } from './content-types.service';
import { ContentTypeDto } from './dto/content-response.dto';
import { CreateContentTypeDto, UpdateContentTypeDto } from './dto/content-types.dto';

interface ContentTypeResponse {
  data: ContentTypeRow;
}

const ID_PARAM = { name: 'id', description: 'UUID or erc:<externalReferenceCode>' };

@ApiTags('content-types')
@ApiBearerAuth()
@Controller('content-types')
export class ContentTypesController {
  constructor(private readonly contentTypesService: ContentTypesService) {}

  @Get()
  @ApiListResponse(ContentTypeDto)
  @RequirePermission('content-type:read')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListQueryDto,
  ): Promise<{ data: ContentTypeRow[]; meta: { cursor: string | null; limit: number } }> {
    const page = await this.contentTypesService.list(user.tenantId, query);
    return { data: page.items, meta: { cursor: page.nextCursor, limit: page.limit } };
  }

  @Get(':id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(ContentTypeDto)
  @RequirePermission('content-type:read')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ContentTypeResponse> {
    return { data: await this.contentTypesService.getByRef(user.tenantId, id) };
  }

  @Post()
  @ApiDataResponse(ContentTypeDto, { status: 201 })
  @RequirePermission('content-type:create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateContentTypeDto,
  ): Promise<ContentTypeResponse> {
    return { data: await this.contentTypesService.create(user.tenantId, user.id, dto) };
  }

  @Patch(':id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(ContentTypeDto)
  @RequirePermission('content-type:update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateContentTypeDto,
  ): Promise<ContentTypeResponse> {
    return { data: await this.contentTypesService.update(user.tenantId, id, dto) };
  }

  @Delete(':id')
  @ApiParam(ID_PARAM)
  @RequirePermission('content-type:delete')
  @HttpCode(204)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.contentTypesService.delete(user.tenantId, id);
  }
}
