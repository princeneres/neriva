import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiDataResponse, ApiListResponse } from '../../common/api-envelope.decorators';
import { SearchableListQueryDto } from '../../common/list-query.dto';
import { CurrentUser } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../roles/require-permission.decorator';
import { SiteDto } from './dto/site-response.dto';
import { CreateSiteDto, UpdateSiteDto } from './dto/sites.dto';
import { SitesService, type SiteRow } from './sites.service';

interface SiteResponse {
  data: SiteRow;
}

const ID_PARAM = { name: 'id', description: 'UUID or erc:<externalReferenceCode>' };

@ApiTags('sites')
@ApiBearerAuth()
@Controller('sites')
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Get()
  @ApiListResponse(SiteDto)
  @RequirePermission('site:read')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SearchableListQueryDto,
  ): Promise<{ data: SiteRow[]; meta: { cursor: string | null; limit: number } }> {
    const page = await this.sitesService.list(user.tenantId, query);
    return { data: page.items, meta: { cursor: page.nextCursor, limit: page.limit } };
  }

  @Get(':id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(SiteDto)
  @RequirePermission('site:read')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<SiteResponse> {
    return { data: await this.sitesService.getByRef(user.tenantId, id) };
  }

  @Post()
  @ApiDataResponse(SiteDto, { status: 201 })
  @RequirePermission('site:create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSiteDto,
  ): Promise<SiteResponse> {
    return { data: await this.sitesService.create(user.tenantId, user.id, dto) };
  }

  @Patch(':id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(SiteDto)
  @RequirePermission('site:update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSiteDto,
  ): Promise<SiteResponse> {
    return { data: await this.sitesService.update(user.tenantId, id, dto) };
  }

  @Delete(':id')
  @ApiParam(ID_PARAM)
  @RequirePermission('site:delete')
  @HttpCode(204)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.sitesService.delete(user.tenantId, id);
  }
}
