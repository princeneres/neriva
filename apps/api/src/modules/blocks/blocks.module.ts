import { Module } from '@nestjs/common';
import { ResourceFoldersModule } from '../resource-folders/resource-folders.module';
import { BlocksController } from './blocks.controller';
import { BlocksService } from './blocks.service';

@Module({
  imports: [ResourceFoldersModule],
  controllers: [BlocksController],
  providers: [BlocksService],
  exports: [BlocksService],
})
export class BlocksModule {}
