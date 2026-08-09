import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DbModule } from './db/db.module';
import { AuthModule } from './modules/auth/auth.module';
import { BlocksModule } from './modules/blocks/blocks.module';
import { ContentModule } from './modules/content/content.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { ObjectsModule } from './modules/objects/objects.module';
import { PageTemplatesModule } from './modules/page-templates/page-templates.module';
import { PagesModule } from './modules/pages/pages.module';
import { RolesModule } from './modules/roles/roles.module';
import { SitesModule } from './modules/sites/sites.module';
import { StylebookModule } from './modules/stylebook/stylebook.module';
import { SystemModule } from './modules/system/system.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  // AuthModule before RolesModule: global guard order is auth, then
  // mustChangePassword, then permissions.
  imports: [
    // Generous global ceiling; auth endpoints carry stricter @Throttle limits.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    DbModule,
    AuthModule,
    RolesModule,
    UsersModule,
    SitesModule,
    PageTemplatesModule,
    PagesModule,
    BlocksModule,
    ContentModule,
    DeliveryModule,
    ObjectsModule,
    StylebookModule,
    SystemModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
