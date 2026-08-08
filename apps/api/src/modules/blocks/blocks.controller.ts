import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiDataResponse, ApiListResponse } from '../../common/api-envelope.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../roles/require-permission.decorator';
import { BlocksService, type BlockRow } from './blocks.service';
import { BlockDto } from './dto/block-response.dto';
import { CreateBlockDto, ListBlocksQueryDto, UpdateBlockDto } from './dto/blocks.dto';

interface BlockResponse {
  data: BlockRow;
}

const ID_PARAM = { name: 'id', description: 'UUID or erc:<externalReferenceCode>' };

@ApiTags('blocks')
@ApiBearerAuth()
@Controller('blocks')
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @Get()
  @ApiListResponse(BlockDto)
  @RequirePermission('block:read')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListBlocksQueryDto,
  ): Promise<{ data: BlockRow[]; meta: { cursor: string | null; limit: number } }> {
    const page = await this.blocksService.list(user.tenantId, query);
    return { data: page.items, meta: { cursor: page.nextCursor, limit: page.limit } };
  }

  @Get(':id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(BlockDto)
  @RequirePermission('block:read')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<BlockResponse> {
    return { data: await this.blocksService.getByRef(user.tenantId, id) };
  }

  @Post()
  @ApiDataResponse(BlockDto, { status: 201 })
  @RequirePermission('block:create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBlockDto,
  ): Promise<BlockResponse> {
    return { data: await this.blocksService.create(user.tenantId, user.id, dto) };
  }

  @Patch(':id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(BlockDto)
  @RequirePermission('block:update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateBlockDto,
  ): Promise<BlockResponse> {
    return { data: await this.blocksService.update(user.tenantId, id, dto) };
  }

  @Delete(':id')
  @ApiParam(ID_PARAM)
  @RequirePermission('block:delete')
  @HttpCode(204)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.blocksService.delete(user.tenantId, id);
  }

  @Post(':id/publish')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(BlockDto)
  @RequirePermission('block:publish')
  @HttpCode(200)
  async publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<BlockResponse> {
    return { data: await this.blocksService.publish(user.tenantId, id) };
  }
}
