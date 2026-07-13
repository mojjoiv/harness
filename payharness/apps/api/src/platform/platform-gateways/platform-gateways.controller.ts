import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { Provider, PlatformRole } from '@prisma/client';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PlatformJwtAuthGuard } from '../common/platform-jwt-auth.guard';
import { PlatformGatewaysService } from './platform-gateways.service';

@Controller('platform/gateways')
@UseGuards(PlatformJwtAuthGuard, RolesGuard)
export class PlatformGatewaysController {
  constructor(private readonly gateways: PlatformGatewaysService) {}

  @Get()
  list() {
    return this.gateways.list();
  }

  @Patch(':provider/toggle')
  @Roles(PlatformRole.SUPERADMIN)
  toggle(@Param('provider') provider: Provider, @CurrentUser() user: AuthUser) {
    return this.gateways.toggle(provider, user.userId);
  }
}
