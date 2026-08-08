import { Module } from '@nestjs/common';
import { SystemModule } from './modules/system/system.module';

@Module({
  imports: [SystemModule],
})
export class AppModule {}
