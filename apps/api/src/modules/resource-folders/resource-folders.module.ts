import { Module } from '@nestjs/common';
import { ResourceFoldersController } from './resource-folders.controller';
import { ResourceFoldersService } from './resource-folders.service';

@Module({
  controllers: [ResourceFoldersController],
  providers: [ResourceFoldersService],
  exports: [ResourceFoldersService],
})
export class ResourceFoldersModule {}
