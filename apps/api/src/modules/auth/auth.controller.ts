import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiDataResponse } from '../../common/api-envelope.decorators';
import { CurrentUser, Public, SkipMustChangePassword } from './auth.decorators';
import { AuthService } from './auth.service';
import {
  type AuthenticatedUser,
  type AuthTokens,
  type PublicUser,
  toPublicUser,
} from './auth.types';
import { AuthTokensDto, PublicUserDto } from './dto/auth-response.dto';
import { ChangePasswordDto, LoginDto, LogoutDto, RefreshDto } from './dto/auth.dto';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  // Brute-force protection: per-IP, in-memory (single-container deploys).
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiDataResponse(AuthTokensDto)
  async login(@Body() dto: LoginDto): Promise<{ data: AuthTokens }> {
    return { data: await this.authService.login(dto.email, dto.password) };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiDataResponse(AuthTokensDto)
  async refresh(@Body() dto: RefreshDto): Promise<{ data: AuthTokens }> {
    return { data: await this.authService.refresh(dto.refreshToken) };
  }

  @SkipMustChangePassword()
  @Post('logout')
  @HttpCode(204)
  @ApiNoContentResponse()
  async logout(@Body() dto: LogoutDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  @SkipMustChangePassword()
  @Post('change-password')
  @HttpCode(200)
  @ApiDataResponse(AuthTokensDto)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ data: AuthTokens }> {
    return {
      data: await this.authService.changePassword(user, dto.currentPassword, dto.newPassword),
    };
  }

  @Get('me')
  @ApiDataResponse(PublicUserDto)
  me(@CurrentUser() user: AuthenticatedUser): { data: PublicUser } {
    return { data: toPublicUser(user) };
  }
}
