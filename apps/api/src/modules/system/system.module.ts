import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { SettingsCatalogController } from './settings-catalog.controller';
import { SystemSettingsController } from './system-settings.controller';
import { SystemSettingsService } from './system-settings.service';

@Module({
  controllers: [HealthController, SettingsCatalogController, SystemSettingsController],
  providers: [SystemSettingsService],
  exports: [SystemSettingsService],
})
export class SystemModule {}
