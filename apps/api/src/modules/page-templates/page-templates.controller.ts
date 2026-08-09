import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiDataResponse, ApiListResponse } from '../../common/api-envelope.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../roles/require-permission.decorator';
import { PageTemplateDto } from './dto/page-template-response.dto';
import {
  CreatePageTemplateDto,
  ListPageTemplatesQueryDto,
  UpdatePageTemplateDto,
} from './dto/page-templates.dto';
import { PageTemplatesService, type PageTemplateRow } from './page-templates.service';

interface PageTemplateResponse {
  data: PageTemplateRow;
}

const ID_PARAM = { name: 'id', description: 'UUID or erc:<externalReferenceCode>' };

@ApiTags('page-templates')
@ApiBearerAuth()
@Controller('page-templates')
export class PageTemplatesController {
  constructor(private readonly pageTemplatesService: PageTemplatesService) {}

  @Get()
  @ApiListResponse(PageTemplateDto)
  @RequirePermission('page-template:read')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPageTemplatesQueryDto,
  ): Promise<{ data: PageTemplateRow[]; meta: { cursor: string | null; limit: number } }> {
    const page = await this.pageTemplatesService.list(user.tenantId, query);
    return { data: page.items, meta: { cursor: page.nextCursor, limit: page.limit } };
  }

  @Get(':id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(PageTemplateDto)
  @RequirePermission('page-template:read')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<PageTemplateResponse> {
    return { data: await this.pageTemplatesService.getByRef(user.tenantId, id) };
  }

  @Post()
  @ApiDataResponse(PageTemplateDto, { status: 201 })
  @RequirePermission('page-template:create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePageTemplateDto,
  ): Promise<PageTemplateResponse> {
    return { data: await this.pageTemplatesService.create(user.tenantId, user.id, dto) };
  }

  @Patch(':id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(PageTemplateDto)
  @RequirePermission('page-template:update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePageTemplateDto,
  ): Promise<PageTemplateResponse> {
    return { data: await this.pageTemplatesService.update(user.tenantId, id, dto) };
  }

  @Delete(':id')
  @ApiParam(ID_PARAM)
  @RequirePermission('page-template:delete')
  @HttpCode(204)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.pageTemplatesService.delete(user.tenantId, id);
  }
}
