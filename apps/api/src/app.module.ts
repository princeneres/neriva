import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { SystemModule } from './modules/system/system.module';

@Module({
  imports: [DbModule, SystemModule],
})
export class AppModule {}
