import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ListQueryDto } from '../../common/list-query.dto';
import { CurrentUser } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateRoleDto, UpdateRoleDto } from './dto/roles.dto';
import { RequirePermission } from './require-permission.decorator';
import { RolesService, type RoleWithPermissions } from './roles.service';

interface RoleResponse {
  data: RoleWithPermissions;
}

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermission('role:read')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListQueryDto,
  ): Promise<{ data: RoleWithPermissions[]; meta: { cursor: string | null; limit: number } }> {
    const page = await this.rolesService.list(user.tenantId, query);
    return { data: page.items, meta: { cursor: page.nextCursor, limit: page.limit } };
  }

  @Get(':id')
  @RequirePermission('role:read')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<RoleResponse> {
    return { data: await this.rolesService.getById(user.tenantId, id) };
  }

  @Post()
  @RequirePermission('role:create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRoleDto,
  ): Promise<RoleResponse> {
    return { data: await this.rolesService.create(user.tenantId, user.id, dto) };
  }

  @Patch(':id')
  @RequirePermission('role:update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RoleResponse> {
    return { data: await this.rolesService.update(user.tenantId, id, dto) };
  }

  @Delete(':id')
  @RequirePermission('role:delete')
  @HttpCode(204)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.rolesService.delete(user.tenantId, id);
  }
}
