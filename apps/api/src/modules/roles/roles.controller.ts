import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiDataResponse, ApiListResponse } from '../../common/api-envelope.decorators';
import { SearchableListQueryDto } from '../../common/list-query.dto';
import { CurrentUser } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RoleDto } from './dto/role-response.dto';
import { CreateRoleDto, UpdateRoleDto } from './dto/roles.dto';
import { RequirePermission } from './require-permission.decorator';
import { RolesService, type RoleWithPermissions } from './roles.service';

interface RoleResponse {
  data: RoleWithPermissions;
}

const ID_PARAM = { name: 'id', description: 'UUID or erc:<externalReferenceCode>' };

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiListResponse(RoleDto)
  @RequirePermission('role:read')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SearchableListQueryDto,
  ): Promise<{ data: RoleWithPermissions[]; meta: { cursor: string | null; limit: number } }> {
    const page = await this.rolesService.list(user.tenantId, query);
    return { data: page.items, meta: { cursor: page.nextCursor, limit: page.limit } };
  }

  @Get(':id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(RoleDto)
  @RequirePermission('role:read')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<RoleResponse> {
    return { data: await this.rolesService.getByRef(user.tenantId, id) };
  }

  @Post()
  @ApiDataResponse(RoleDto, { status: 201 })
  @RequirePermission('role:create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRoleDto,
  ): Promise<RoleResponse> {
    return { data: await this.rolesService.create(user.tenantId, user.id, dto) };
  }

  @Patch(':id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(RoleDto)
  @RequirePermission('role:update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleResponse> {
    return { data: await this.rolesService.update(user.tenantId, id, dto) };
  }

  @Delete(':id')
  @ApiParam(ID_PARAM)
  @RequirePermission('role:delete')
  @HttpCode(204)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.rolesService.delete(user.tenantId, id);
  }
}
