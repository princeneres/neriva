import { Module } from '@nestjs/common';
import { StylebookController } from './stylebook.controller';
import { StylebookService } from './stylebook.service';

@Module({
  controllers: [StylebookController],
  providers: [StylebookService],
  exports: [StylebookService],
})
export class StylebookModule {}
