import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiDataResponse } from '../../common/api-envelope.decorators';
import { CurrentUser } from '../auth/auth.decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../roles/require-permission.decorator';
import { SettingsCatalogDto } from './dto/settings-catalog.dto';
import { SystemSettingsService, type SettingsCatalogView } from './system-settings.service';

// Its own path rather than /system/settings/catalog: "catalog" is a legal
// setting key, and shadowing a stored key with a metadata route would hide
// that row from GET.
@ApiTags('system')
@ApiBearerAuth()
@Controller('system/settings-catalog')
export class SettingsCatalogController {
  constructor(private readonly settingsService: SystemSettingsService) {}

  @Get()
  @ApiDataResponse(SettingsCatalogDto)
  @RequirePermission('system-setting:read')
  async get(@CurrentUser() user: AuthenticatedUser): Promise<{ data: SettingsCatalogView }> {
    return { data: await this.settingsService.catalog(user.tenantId) };
  }
}
