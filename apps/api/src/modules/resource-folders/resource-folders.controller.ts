import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiDataResponse, ApiListResponse } from '../../common/api-envelope.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../roles/require-permission.decorator';
import { ResourceFolderDto } from './dto/resource-folder-response.dto';
import {
  CreateResourceFolderDto,
  ListResourceFoldersQueryDto,
  UpdateResourceFolderDto,
} from './dto/resource-folders.dto';
import { ResourceFoldersService, type ResourceFolderRow } from './resource-folders.service';

const ID_PARAM = { name: 'id', description: 'UUID or erc:<externalReferenceCode>' };

@ApiTags('resource-folders')
@ApiBearerAuth()
@Controller('resource-folders')
export class ResourceFoldersController {
  constructor(private readonly foldersService: ResourceFoldersService) {}

  @Get()
  @ApiListResponse(ResourceFolderDto)
  @RequirePermission('resource-folder:read')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListResourceFoldersQueryDto,
  ): Promise<{ data: ResourceFolderRow[]; meta: { cursor: string | null; limit: number } }> {
    const page = await this.foldersService.list(user.tenantId, query);
    return { data: page.items, meta: { cursor: page.nextCursor, limit: page.limit } };
  }

  @Get(':id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(ResourceFolderDto)
  @RequirePermission('resource-folder:read')
  async get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return { data: await this.foldersService.getByRef(user.tenantId, id) };
  }

  @Post()
  @ApiDataResponse(ResourceFolderDto, { status: 201 })
  @RequirePermission('resource-folder:create')
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateResourceFolderDto) {
    return { data: await this.foldersService.create(user.tenantId, user.id, dto) };
  }

  @Patch(':id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(ResourceFolderDto)
  @RequirePermission('resource-folder:update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateResourceFolderDto,
  ) {
    return { data: await this.foldersService.update(user.tenantId, id, dto.name) };
  }

  @Delete(':id')
  @ApiParam(ID_PARAM)
  @RequirePermission('resource-folder:delete')
  @HttpCode(204)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.foldersService.delete(user.tenantId, id);
  }
}
