import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PlatformJwtAuthGuard } from '../common/platform-jwt-auth.guard';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { PlatformAuthService } from './platform-auth.service';

@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private readonly platformAuth: PlatformAuthService) {}

  @Post('login')
  login(@Body() dto: PlatformLoginDto) {
    return this.platformAuth.login(dto);
  }

  @Get('profile')
  @UseGuards(PlatformJwtAuthGuard)
  profile(@CurrentUser() user: { userId: string }) {
    return this.platformAuth.profile(user.userId);
  }
}
