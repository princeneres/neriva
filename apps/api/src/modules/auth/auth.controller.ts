import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { CurrentUser, Public, SkipMustChangePassword } from './auth.decorators';
import { AuthService } from './auth.service';
import {
  type AuthenticatedUser,
  type AuthTokens,
  type PublicUser,
  toPublicUser,
} from './auth.types';
import { ChangePasswordDto, LoginDto, LogoutDto, RefreshDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto): Promise<{ data: AuthTokens }> {
    return { data: await this.authService.login(dto.email, dto.password) };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshDto): Promise<{ data: AuthTokens }> {
    return { data: await this.authService.refresh(dto.refreshToken) };
  }

  @SkipMustChangePassword()
  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: LogoutDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  @SkipMustChangePassword()
  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ data: AuthTokens }> {
    return {
      data: await this.authService.changePassword(user, dto.currentPassword, dto.newPassword),
    };
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): { data: PublicUser } {
    return { data: toPublicUser(user) };
  }
}
