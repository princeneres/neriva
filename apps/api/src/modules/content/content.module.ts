import { Module } from '@nestjs/common';
import { SitesModule } from '../sites/sites.module';
import { ContentEntriesController } from './content-entries.controller';
import { ContentEntriesService } from './content-entries.service';
import { ContentTypesController } from './content-types.controller';
import { ContentTypesService } from './content-types.service';

@Module({
  // SitesModule: site reference resolution for entry siteId (public interface).
  imports: [SitesModule],
  controllers: [ContentTypesController, ContentEntriesController],
  providers: [ContentTypesService, ContentEntriesService],
  exports: [ContentTypesService, ContentEntriesService],
})
export class ContentModule {}
