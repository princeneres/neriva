import { Module } from '@nestjs/common';
import { PageTemplatesModule } from '../page-templates/page-templates.module';
import { SystemModule } from '../system/system.module';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';

@Module({
  // SystemModule exports SystemSettingsService, the public interface the
  // default-site resolution (spec 13) reads the site.default setting through;
  // PageTemplatesModule exports the master-page resolution used to compose
  // a page's tree (spec 14).
  imports: [SystemModule, PageTemplatesModule],
  controllers: [DeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
