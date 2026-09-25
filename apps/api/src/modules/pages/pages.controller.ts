import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiDataResponse, ApiListResponse } from '../../common/api-envelope.decorators';
import { SearchableListQueryDto } from '../../common/list-query.dto';
import { CurrentUser } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../roles/require-permission.decorator';
import { PageDto } from './dto/page-response.dto';
import { CreatePageDto, UpdatePageDto } from './dto/pages.dto';
import { PagesService, type PageRow } from './pages.service';

interface PageResponse {
  data: PageRow;
}

const ID_PARAM = { name: 'id', description: 'UUID or erc:<externalReferenceCode>' };
const SITE_REF_PARAM = {
  name: 'siteRef',
  description: 'Site UUID or erc:<externalReferenceCode>',
};

@ApiTags('pages')
@ApiBearerAuth()
@Controller()
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get('sites/:siteRef/pages')
  @ApiParam(SITE_REF_PARAM)
  @ApiListResponse(PageDto)
  @RequirePermission('page:read')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('siteRef') siteRef: string,
    @Query() query: SearchableListQueryDto,
  ): Promise<{ data: PageRow[]; meta: { cursor: string | null; limit: number } }> {
    const page = await this.pagesService.listBySite(user.tenantId, siteRef, query);
    return { data: page.items, meta: { cursor: page.nextCursor, limit: page.limit } };
  }

  @Post('sites/:siteRef/pages')
  @ApiParam(SITE_REF_PARAM)
  @ApiDataResponse(PageDto, { status: 201 })
  @RequirePermission('page:create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('siteRef') siteRef: string,
    @Body() dto: CreatePageDto,
  ): Promise<PageResponse> {
    return { data: await this.pagesService.create(user.tenantId, user.id, siteRef, dto) };
  }

  @Get('pages/:id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(PageDto)
  @RequirePermission('page:read')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<PageResponse> {
    return { data: await this.pagesService.getByRef(user.tenantId, id) };
  }

  @Patch('pages/:id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(PageDto)
  @RequirePermission('page:update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePageDto,
  ): Promise<PageResponse> {
    return { data: await this.pagesService.update(user.tenantId, id, dto) };
  }

  @Delete('pages/:id')
  @ApiParam(ID_PARAM)
  @RequirePermission('page:delete')
  @HttpCode(204)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.pagesService.delete(user.tenantId, id);
  }

  @Post('pages/:id/publish')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(PageDto)
  @RequirePermission('page:publish')
  @HttpCode(200)
  async publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<PageResponse> {
    return { data: await this.pagesService.publish(user.tenantId, id) };
  }
}
