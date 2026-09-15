import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiDataResponse, ApiListResponse } from '../../common/api-envelope.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../roles/require-permission.decorator';
import {
  CreateObjectDefinitionDto,
  ListObjectDefinitionsQueryDto,
  UpdateObjectDefinitionDto,
} from './dto/object-definitions.dto';
import { ObjectDefinitionDto } from './dto/object-response.dto';
import { ObjectDefinitionsService, type ObjectDefinitionRow } from './object-definitions.service';

interface DefinitionResponse {
  data: ObjectDefinitionRow;
}

const ID_PARAM = { name: 'id', description: 'UUID or erc:<externalReferenceCode>' };

@ApiTags('object-definitions')
@ApiBearerAuth()
@Controller('object-definitions')
export class ObjectDefinitionsController {
  constructor(private readonly definitionsService: ObjectDefinitionsService) {}

  @Get()
  @ApiListResponse(ObjectDefinitionDto)
  @RequirePermission('object-definition:read')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListObjectDefinitionsQueryDto,
  ): Promise<{ data: ObjectDefinitionRow[]; meta: { cursor: string | null; limit: number } }> {
    const page = await this.definitionsService.list(user.tenantId, query);
    return { data: page.items, meta: { cursor: page.nextCursor, limit: page.limit } };
  }

  @Get(':id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(ObjectDefinitionDto)
  @RequirePermission('object-definition:read')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DefinitionResponse> {
    return { data: await this.definitionsService.getByRef(user.tenantId, id) };
  }

  @Post()
  @ApiDataResponse(ObjectDefinitionDto, { status: 201 })
  @RequirePermission('object-definition:create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateObjectDefinitionDto,
  ): Promise<DefinitionResponse> {
    return { data: await this.definitionsService.create(user.tenantId, user.id, dto) };
  }

  @Patch(':id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(ObjectDefinitionDto)
  @RequirePermission('object-definition:update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateObjectDefinitionDto,
  ): Promise<DefinitionResponse> {
    return { data: await this.definitionsService.update(user.tenantId, id, dto) };
  }

  @Delete(':id')
  @ApiParam(ID_PARAM)
  @RequirePermission('object-definition:delete')
  @HttpCode(204)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.definitionsService.delete(user.tenantId, id);
  }
}
