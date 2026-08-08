import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { AuthModule } from './modules/auth/auth.module';
import { SystemModule } from './modules/system/system.module';

@Module({
  imports: [DbModule, AuthModule, SystemModule],
})
export class AppModule {}
