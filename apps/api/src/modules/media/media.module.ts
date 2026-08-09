import { Module } from '@nestjs/common';
import { SitesModule } from '../sites/sites.module';
import { MediaPublicController } from './media-public.controller';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { StorageService } from './storage.service';

@Module({
  imports: [SitesModule],
  controllers: [MediaController, MediaPublicController],
  providers: [MediaService, StorageService],
  exports: [MediaService],
})
export class MediaModule {}
