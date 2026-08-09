import { Module } from '@nestjs/common';
import { SitesModule } from '../sites/sites.module';
import { SystemModule } from '../system/system.module';
import { PageTemplatesController } from './page-templates.controller';
import { PageTemplatesService } from './page-templates.service';

@Module({
  imports: [SitesModule, SystemModule],
  controllers: [PageTemplatesController],
  providers: [PageTemplatesService],
  exports: [PageTemplatesService],
})
export class PageTemplatesModule {}
