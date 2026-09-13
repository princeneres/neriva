import { Body, Controller, Delete, Get, HttpCode, Param, Put, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { ApiDataResponse, ApiListResponse } from '../../common/api-envelope.decorators';
import { ListQueryDto } from '../../common/list-query.dto';
import { CurrentUser } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../roles/require-permission.decorator';
import { SystemSettingDto, UpsertSystemSettingDto } from './dto/system-settings.dto';
import {
  SystemSettingsService,
  toSystemSettingResponse,
  type SystemSettingResponse,
} from './system-settings.service';

const KEY_PARAM = {
  name: 'key',
  description: 'Setting key, pattern ^[a-z][a-z0-9.-]*$ (not an entity ref)',
};

@ApiTags('system')
@ApiBearerAuth()
@Controller('system/settings')
export class SystemSettingsController {
  constructor(private readonly settingsService: SystemSettingsService) {}

  @Get()
  @ApiListResponse(SystemSettingDto)
  @RequirePermission('system-setting:read')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListQueryDto,
  ): Promise<{ data: SystemSettingResponse[]; meta: { cursor: string | null; limit: number } }> {
    const page = await this.settingsService.list(user.tenantId, query);
    return {
      data: page.items.map(toSystemSettingResponse),
      meta: { cursor: page.nextCursor, limit: page.limit },
    };
  }

  @Get(':key')
  @ApiParam(KEY_PARAM)
  @ApiDataResponse(SystemSettingDto)
  @RequirePermission('system-setting:read')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
  ): Promise<{ data: SystemSettingResponse }> {
    return {
      data: toSystemSettingResponse(await this.settingsService.getByKey(user.tenantId, key)),
    };
  }

  @Put(':key')
  @ApiParam(KEY_PARAM)
  @ApiDataResponse(SystemSettingDto, { status: 200 })
  @ApiDataResponse(SystemSettingDto, { status: 201 })
  @RequirePermission('system-setting:update')
  async upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body() dto: UpsertSystemSettingDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ data: SystemSettingResponse }> {
    const { setting, created } = await this.settingsService.upsert(
      user.tenantId,
      user.id,
      key,
      dto.value,
    );
    void reply.status(created ? 201 : 200);
    return { data: toSystemSettingResponse(setting) };
  }

  @Delete(':key')
  @ApiParam(KEY_PARAM)
  @RequirePermission('system-setting:delete')
  @HttpCode(204)
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('key') key: string): Promise<void> {
    await this.settingsService.deleteByKey(user.tenantId, key);
  }
}
