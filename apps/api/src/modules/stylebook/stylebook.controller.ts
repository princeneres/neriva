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
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { ApiDataResponse, ApiListResponse } from '../../common/api-envelope.decorators';
import { SearchableListQueryDto } from '../../common/list-query.dto';
import { CurrentUser } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../roles/require-permission.decorator';
import { StyleBookDto } from './dto/style-book-response.dto';
import { CreateStyleBookDto, UpdateStyleBookDto } from './dto/style-books.dto';
import { StylebookService, type StyleBookRow } from './stylebook.service';

const ID_PARAM = { name: 'id', description: 'UUID or erc:<externalReferenceCode>' };

@ApiTags('style-books')
@ApiBearerAuth()
@Controller('style-books')
export class StylebookController {
  constructor(private readonly stylebookService: StylebookService) {}

  @Get()
  @ApiListResponse(StyleBookDto)
  @RequirePermission('style-book:read')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SearchableListQueryDto,
  ): Promise<{ data: StyleBookRow[]; meta: { cursor: string | null; limit: number } }> {
    const page = await this.stylebookService.list(user.tenantId, query);
    return { data: page.items, meta: { cursor: page.nextCursor, limit: page.limit } };
  }

  @Get(':id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(StyleBookDto)
  @RequirePermission('style-book:read')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ data: StyleBookRow }> {
    return { data: await this.stylebookService.getByRef(user.tenantId, id) };
  }

  @Post()
  @ApiDataResponse(StyleBookDto, { status: 201 })
  @RequirePermission('style-book:create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStyleBookDto,
  ): Promise<{ data: StyleBookRow }> {
    return { data: await this.stylebookService.create(user.tenantId, user.id, dto) };
  }

  @Patch(':id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(StyleBookDto)
  @RequirePermission('style-book:update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateStyleBookDto,
  ): Promise<{ data: StyleBookRow }> {
    return { data: await this.stylebookService.update(user.tenantId, id, dto) };
  }

  @Delete(':id')
  @ApiParam(ID_PARAM)
  @RequirePermission('style-book:delete')
  @HttpCode(204)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.stylebookService.delete(user.tenantId, id);
  }

  @Post(':id/publish')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(StyleBookDto)
  @RequirePermission('style-book:publish')
  @HttpCode(200)
  async publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ data: StyleBookRow }> {
    return { data: await this.stylebookService.publish(user.tenantId, id) };
  }

  @Get(':id/css')
  @ApiParam(ID_PARAM)
  @ApiResponse({
    status: 200,
    description: 'Design tokens rendered as CSS custom properties on :root',
    content: { 'text/css': { schema: { type: 'string' } } },
  })
  @RequirePermission('style-book:read')
  async css(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    // passthrough: false takes over the response, bypassing the JSON
    // envelope interceptor for the raw text/css body.
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    const css = await this.stylebookService.renderCssByRef(user.tenantId, id);
    await reply.type('text/css').send(css);
  }
}
