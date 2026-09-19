import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { MustChangePasswordGuard } from './must-change-password.guard';
import { assertProductionAuthConfig } from './auth-config';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        assertProductionAuthConfig();
        return {
          secret: process.env.JWT_ACCESS_SECRET ?? 'dev-insecure-access-secret',
          signOptions: {
            expiresIn: (process.env.JWT_ACCESS_TTL ?? '15m') as JwtSignOptions['expiresIn'],
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Registration order matters: authenticate first, then enforce the
    // pending password change.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: MustChangePasswordGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
