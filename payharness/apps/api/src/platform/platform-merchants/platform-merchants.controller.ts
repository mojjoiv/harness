import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { MerchantStatus, PlatformRole } from '@prisma/client';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PlatformJwtAuthGuard } from '../common/platform-jwt-auth.guard';
import { AssignPlanDto } from '../platform-plans/dto/plan.dto';
import { PlatformMerchantsService } from './platform-merchants.service';

@Controller('platform/merchants')
@UseGuards(PlatformJwtAuthGuard, RolesGuard)
export class PlatformMerchantsController {
  constructor(private readonly merchants: PlatformMerchantsService) {}

  @Get()
  list(@Query('status') status?: string) {
    const normalized =
      status && Object.values(MerchantStatus).includes(status as MerchantStatus)
        ? (status as MerchantStatus)
        : undefined;
    return this.merchants.list(normalized);
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

  @Patch(':id/plan')
  @Roles(PlatformRole.SUPERADMIN)
  assignPlan(@Param('id') id: string, @Body() dto: AssignPlanDto, @CurrentUser() user: AuthUser) {
    return this.merchants.assignPlan(id, dto.planId, user.userId);
  }

  @Get(':id/providers')
  providers(@Param('id') id: string) {
    return this.merchants.providers(id);
  }

  @Patch(':id/providers/:credentialId/force-disconnect')
  @Roles(PlatformRole.SUPERADMIN)
  forceDisconnectProvider(
    @Param('id') id: string,
    @Param('credentialId') credentialId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.merchants.forceDisconnectProvider(id, credentialId, user.userId);
  }
}
