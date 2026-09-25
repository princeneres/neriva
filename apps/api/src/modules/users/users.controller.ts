import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { ApiDataResponse, ApiListResponse } from '../../common/api-envelope.decorators';
import { SearchableListQueryDto } from '../../common/list-query.dto';
import { CurrentUser } from '../auth/auth.decorators';
import type { AuthenticatedUser, PublicUser } from '../auth/auth.types';
import { PublicUserDto } from '../auth/dto/auth-response.dto';
import { AssignRoleDto } from '../roles/dto/roles.dto';
import { RequirePermission } from '../roles/require-permission.decorator';
import { CreateUserDto, UpdateUserDto } from './dto/users.dto';
import { UsersService } from './users.service';

const ID_PARAM = { name: 'id', description: 'UUID or erc:<externalReferenceCode>' };

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiListResponse(PublicUserDto)
  @RequirePermission('user:read')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SearchableListQueryDto,
  ): Promise<{ data: PublicUser[]; meta: { cursor: string | null; limit: number } }> {
    const page = await this.usersService.list(user.tenantId, query);
    return { data: page.items, meta: { cursor: page.nextCursor, limit: page.limit } };
  }

  @Get(':id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(PublicUserDto)
  @RequirePermission('user:read')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ data: PublicUser }> {
    return { data: await this.usersService.getByRef(user.tenantId, id) };
  }

  @Post()
  @ApiDataResponse(PublicUserDto, { status: 201 })
  @RequirePermission('user:create')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUserDto,
  ): Promise<{ data: PublicUser }> {
    return { data: await this.usersService.create(user.tenantId, user.id, dto) };
  }

  @Patch(':id')
  @ApiParam(ID_PARAM)
  @ApiDataResponse(PublicUserDto)
  @RequirePermission('user:update')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<{ data: PublicUser }> {
    return { data: await this.usersService.update(user.tenantId, id, dto) };
  }

  @Delete(':id')
  @ApiParam(ID_PARAM)
  @RequirePermission('user:delete')
  @HttpCode(204)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.usersService.delete(user.tenantId, id);
  }

  @Post(':id/roles')
  @ApiParam(ID_PARAM)
  @RequirePermission('user:update')
  @HttpCode(204)
  async assignRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
  ): Promise<void> {
    await this.usersService.assignRole(user.tenantId, id, dto.roleId);
  }

  @Delete(':id/roles/:roleId')
  @ApiParam(ID_PARAM)
  @RequirePermission('user:update')
  @HttpCode(204)
  async unassignRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('roleId') roleId: string,
  ): Promise<void> {
    await this.usersService.unassignRole(user.tenantId, id, roleId);
  }
}
