import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AbilityFactory } from './ability.factory';
import { PermissionGuard } from './permission.guard';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
  controllers: [RolesController],
  providers: [
    RolesService,
    AbilityFactory,
    // Runs after AuthGuard and MustChangePasswordGuard (AuthModule is
    // imported before RolesModule in AppModule).
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
  exports: [AbilityFactory],
})
export class RolesModule {}
