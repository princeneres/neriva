import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module';
import { AuthModule } from './modules/auth/auth.module';
import { ObjectsModule } from './modules/objects/objects.module';
import { RolesModule } from './modules/roles/roles.module';
import { SystemModule } from './modules/system/system.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  // AuthModule before RolesModule: global guard order is auth, then
  // mustChangePassword, then permissions.
  imports: [DbModule, AuthModule, RolesModule, UsersModule, ObjectsModule, SystemModule],
})
export class AppModule {}
