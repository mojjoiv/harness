import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PlatformJwtAuthGuard } from '../common/platform-jwt-auth.guard';
import { PlatformMerchantsService } from './platform-merchants.service';

@Controller('platform/merchants')
@UseGuards(PlatformJwtAuthGuard, RolesGuard)
export class PlatformMerchantsController {
  constructor(private readonly merchants: PlatformMerchantsService) {}

  @Get()
  list() {
    return this.merchants.list();
  }

  @Patch(':id/approve')
  @Roles(PlatformRole.SUPERADMIN)
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.merchants.approve(id, user.userId);
  }

  @Patch(':id/reject')
  @Roles(PlatformRole.SUPERADMIN)
  reject(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.merchants.reject(id, user.userId);
  }

  @Patch(':id/suspend')
  @Roles(PlatformRole.SUPERADMIN)
  suspend(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.merchants.suspend(id, user.userId);
  }

  @Patch(':id/activate')
  @Roles(PlatformRole.SUPERADMIN)
  activate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.merchants.activate(id, user.userId);
  }
}
