import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiDataResponse, ApiListResponse } from '../../common/api-envelope.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../roles/require-permission.decorator';
import { ContentEntriesService, type ContentEntryRow } from './content-entries.service';
import {
  CreateContentEntryDto,
  ListContentEntriesQueryDto,
  UpdateContentEntryDto,
} from './dto/content-entries.dto';
import { ContentEntryDto } from './dto/content-response.dto';

interface ContentEntryResponse {
  data: ContentEntryRow;
}

const ID_PARAM = { name: 'id', description: 'UUID or erc:<externalReferenceCode>' };

@ApiTags('content-entries')
@ApiBearerAuth()
@Controller('content-entries')
export class ContentEntriesController {
  constructor(private readonly contentEntriesService: ContentEntriesService) {}

  @Get()
  @ApiListResponse(ContentEntryDto)
  @RequirePermission('content-entry:read')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListContentEntriesQueryDto,
  ): Promise<{ data: ContentEntryRow[]; meta: { cursor: string | null; limit: number } }> {
    const page = await this.contentEntriesService.list(user.tenantId, query);
    return { data: page.items, meta: { cursor: page.nextCursor, limit: page.limit } };
  }

  @Get(':id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(ContentEntryDto)
  @RequirePermission('content-entry:read')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ContentEntryResponse> {
    return { data: await this.contentEntriesService.getByRef(user.tenantId, id) };
  }

  @Post()
  @ApiDataResponse(ContentEntryDto, { status: 201 })
  @RequirePermission('content-entry:create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateContentEntryDto,
  ): Promise<ContentEntryResponse> {
    return { data: await this.contentEntriesService.create(user.tenantId, user.id, dto) };
  }

  @Patch(':id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(ContentEntryDto)
  @RequirePermission('content-entry:update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateContentEntryDto,
  ): Promise<ContentEntryResponse> {
    return { data: await this.contentEntriesService.update(user.tenantId, id, dto) };
  }

  @Delete(':id')
  @ApiParam(ID_PARAM)
  @RequirePermission('content-entry:delete')
  @HttpCode(204)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.contentEntriesService.delete(user.tenantId, id);
  }

  @Post(':id/publish')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(ContentEntryDto)
  @RequirePermission('content-entry:publish')
  @HttpCode(200)
  async publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ContentEntryResponse> {
    return { data: await this.contentEntriesService.publish(user.tenantId, id) };
  }
}
