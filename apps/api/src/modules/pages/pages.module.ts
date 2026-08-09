import { Module } from '@nestjs/common';
import { PageTemplatesModule } from '../page-templates/page-templates.module';
import { SitesModule } from '../sites/sites.module';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';

@Module({
  imports: [SitesModule, PageTemplatesModule],
  controllers: [PagesController],
  providers: [PagesService],
  exports: [PagesService],
})
export class PagesModule {}
