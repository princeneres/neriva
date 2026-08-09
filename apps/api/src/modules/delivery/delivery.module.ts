import { Module } from '@nestjs/common';
import { SystemModule } from '../system/system.module';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';

@Module({
  // SystemModule exports SystemSettingsService, the public interface the
  // default-site resolution (spec 13) reads the site.default setting through.
  imports: [SystemModule],
  controllers: [DeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
